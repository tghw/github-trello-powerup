const GITHUB_ICON = 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/source-branch.svg';
const ICONS = {
  'pr-merged': 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/source-merge.svg',
  'pr-open': 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/source-pull.svg',
  'pr-closed': 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/close.svg',
  'issue-open':  'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/bug.svg',
  'issue-closed':  'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/shield-bug.svg',
  'commit': 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/source-commit.svg',
  'branch': 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/source-branch.svg',
}

// Utility to fetch board-level repository
const getRepository = async (t) => {
  const repo = await t.get('board', 'private', 'githubRepo');
  if (!repo) {
    await t.alert({
      message: 'No repository is associated with this board. Please set a repository in settings.',
      duration: 5,
    });
    return null;
  }
  return repo;
};

const attachGitHubObject = async (t) => {
  const repo = await t.get('board', 'private', 'githubRepo');
  const token = await t.get('member', 'private', 'githubToken');

  if (!repo || !token) {
    await t.alert({
      message: 'Repository or GitHub token not configured. Please set up the integration.',
      duration: 5,
    });
    return;
  }

  const objectTypes = ['Pull Request', 'Issue', 'Branch', 'Commit'];

  // First popup: Select the type of GitHub object
  await t.popup({
    title: 'Select GitHub Object Type',
    items: objectTypes.map((type) => ({
      text: type,
      callback: async (t) => {
        // Handle selection of object type
        try {
          await showSearchPopup(t, type, repo, token);
        } catch (error) {
          console.error(`Error handling ${type}:`, error);
          await t.alert({
            message: `Failed to fetch ${type.toLowerCase()}s from GitHub.`,
            duration: 5,
          });
        }
      },
    })),
  });
};

// Helper to fetch GitHub objects
const fetchGitHubObjects = async (type, repo, token) => {
  const endpoints = {
    'Pull Request': `https://api.github.com/repos/${repo}/pulls?state=all&per_page=100`,
    'Issue': `https://api.github.com/repos/${repo}/issues?state=all&per_page=100`,
    'Branch': `https://api.github.com/repos/${repo}/branches?per_page=100`,
    'Commit': `https://api.github.com/repos/${repo}/commits?per_page=100`,
  };
  const url = endpoints[type];

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${type.toLowerCase()}s: ${response.status} ${response.statusText}`);
  }

  return response.json();
};

const getObjectApiUrl = (object, repo, type) => {
  switch (type) {
    case "Branch":
      return `https://api.github.com/repos/${repo}/branches/${object.name}`;
    case "Commit":
    case "Issue":      
    case "Pull Request":
      return object.url;
  }
}

const whitespaceSubstring = (text, maxLength) => text.length <= maxLength ? text : text.slice(0, text.slice(0, maxLength).lastIndexOf(' ')) || text.slice(0, maxLength);

// Helper to display the search popup
const showSearchPopup = async (t, type, repo, token) => {
  const objects = await fetchGitHubObjects(type, repo, token);
  // Show the search popup
  await t.popup({
    title: `Attach ${type}`,
    search: {
      placeholder: `Search ${type}s`,
      count: 10,
      empty: `No ${type.toLowerCase()}s match your search.`,
      searching: `Searching ${type.toLowerCase()}s...`,
    },
    items: async(t, options) => {
      const search = (options.search || "").toUpperCase();
      const filtered = objects.filter(obj => (obj.title || obj.name || obj.sha.substring(0, 7)).toUpperCase().indexOf(search) != -1);
      const dropdownItems = filtered.map((obj) => {
        let name = null;
        if (type === "Pull Request") {
          name = `${obj.number}: ${obj.title}`
        }
        else if (type === "branch") {
          name = obj.name;
        }
        else if (type === "issue") {
          name = `${obj.number}: ${obj.title}`
        }
        else if (type === "commit") {
          name = `${obj.sha.substring(0, 7)}: ${whitespaceSubstring(obj.message, 20)}`
        }
        return {
          text: name,
          callback: async (t) => {
            await attachToCard(t, obj, name, repo, type, token)
            t.closePopup();
          },
        }
      });
      return dropdownItems;
    },
  });
};

const getCommitShaFromUrl = (url) => {
  const match = url.match(/\/commit\/([a-f0-9]{40})/);
  const sha = match ? match[1] : null;
  if (sha) return sha.substring(0, 7);
  return null;
};

const getBranchNameFromUrl = (url) => {
  const match = url.match(/\/tree\/([^\/]+)/);
  return match ? match[1] : null;
};

const fetchGitHubObjectStatus = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    console.error(`Error fetching GitHub object: ${response.status} ${response.statusText}`);
    return { status: 'Unknown', color: 'red' };
  }

  const data = await response.json();

  // Determine status and color based on the type of object
  if (url.includes('/pulls/')) {
    const state = data.merged ? 'merged' : data.state === 'open' ? 'open' : 'closed';
    return {
      icon: ICONS[`pr-${state}`],
      color: data.merged ? 'purple' : state === 'open' ? 'green' : 'red',
    };
  } else if (url.includes('/issues/')) {
    return {
      icon: ICONS[`issue-${data.state}`],
      color: data.state === 'open' ? 'green' : 'red',
    };
  } else if (url.includes('/commits/')) {
    return {
      icon: ICONS['commit'],
      color: 'blue',
    };
  } else if (url.includes('/branches/')) {
    return {
      icon: ICONS['branch'],
      color: 'blue',
    };
  }
};

const postCommentToGithub = async (repo, number, comment, token) => {
  const url = `https://api.github.com/repos/${repo}/issues/${number}/comments`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: comment }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error(`Error posting comment: ${response.status}`, error);
    throw new Error(`Failed to post comment: ${error.message}`);
  }

  return response.json();
};

const attachToCard = async (t, obj, name, repo, type, token) => {
  const url = getObjectApiUrl(obj, repo, type);
  const link = apiToLink(url);
  await t.attach({ url: link, name: `${type}: ${name}` });
  try {
    if (type === "Pull Request" || type === "Issue") {
      const card = await t.card('url', 'name');
      const comment = `Attached to [${card.name}](${card.url})`
      await postCommentToGithub(repo, obj.number, comment, token)
    }
  }
  catch (e) {
    console.error("Error posting comment", e)
  }
};

const linkToApi = (url) => {
  const baseApiUrl = 'https://api.github.com/repos/';
  const match = url.match(
    /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/(pull|issues|commit|tree)\/([^\/]+)/
  );
  if (!match) {
    throw new Error('Invalid GitHub URL');
  }
  const [, owner, repo, objectType, objectId] = match;
  const apiPaths = { pull: 'pulls', issues: 'issues', commit: 'commits', tree: 'branches'};
  if (!apiPaths[objectType]) {
    throw new Error(`Unsupported object type: ${objectType}`);
  }
  return `${baseApiUrl}${owner}/${repo}/${apiPaths[objectType]}/${objectId}`;
};

const apiToLink = (apiUrl) => {
  const baseWebUrl = 'https://github.com/';
  const match = apiUrl.match(
    /^https:\/\/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)\/(pulls|issues|commits|branches)\/([^\/]+)/
  );
  if (!match) {
    throw new Error('Invalid GitHub API URL');
  }
  const [, owner, repo, objectType, objectId] = match;
  const webPaths = { pulls: 'pull', issues: 'issues', commits: 'commit', branches: 'tree' };
  if (!webPaths[objectType]) {
    throw new Error(`Unsupported object type: ${objectType}`);
  }
  return `${baseWebUrl}${owner}/${repo}/${webPaths[objectType]}/${objectId}`;
};


// Show settings popup
TrelloPowerUp.initialize({
  'attachment-sections': async (t, options) => {
    const claimed = options.entries.filter((attachment) => attachment.url.indexOf("https://github.com/") == 0);
    if (claimed && claimed.length > 0) {
      return [{
        title: "Github",
        claimed: claimed,
        icon: 'https://cdn.jsdelivr.net/npm/@mdi/svg/svg/source-branch.svg',
        content: {
          type: 'iframe',
          url: t.signUrl('./attachment', {arg: ''}),
          height: 30 * claimed.length,
        }
      }]
    }
    return [];
  },
  'show-settings': async (t) => {
    return t.popup({
      title: 'GitHub Repository Settings',
      url: './settings', // Point to your settings page
      height: 200,
    });
  },
  'card-buttons': async (t, options) => {
    return {
      icon: GITHUB_ICON,
      text: 'GitHub ',
      callback: attachGitHubObject,
    };
  },
  'card-badges': async (t) => {
    const token = await t.get('member', 'private', 'githubToken');
    if (!token) {
      return [];
    }

    const attachments = await t.card('attachments');
    const claimed = attachments.attachments.filter((attachment) => attachment.url.indexOf("https://github.com/") == 0);

    if (!claimed || !claimed.length) {
      return [];
    }

    const badges = await Promise.all(
      claimed.map(async (attachment) => {
        const apiUrl = linkToApi(attachment.url);
        try {
          return await fetchGitHubObjectStatus(apiUrl, token);
        } catch (error) {
          console.error(`Error fetching status for ${apiUrl}:`, error);
          return null;
        }
      })
    );

    return badges.filter(Boolean);
  },
  'authorization-status': async (t) => {
    const token = await t.get('member', 'private', 'githubToken');
    return { authorized: !!token };
  },
  'show-authorization': async (t, options) => {
    return t.popup({
      title: 'Authorize GitHub',
      url: './authorize',
      height: 200,
    });
  },
});