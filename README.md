# Github Trello Powerup

This is a powerup for Trello to replace the missing Github powerup.

It is self hosted by [remixing this Glitch](https://glitch.com/edit/#!/remix/github-trello-powerup). I will not be providing support for it, but you can use it if you wish.

## Getting Started

1. Remix this Glitch
2. Create a Github app with the following settings

- Homepage: `https://[your-glitch].glitch.me/`
- Callback URL: `https://[your-glitch].glitch.me/oauth/callback`
- Uncheck "Expire user authorization tokens"
- Deactivate Webhooks
- Permissions:
  - Repository permissions
    - Contents: Read-only
    - Issues: Read-only
    - Metadata: Read-only
    - Pull Requests: Read-only

3. Set the environment variables in your Glitch remix:

- GITHUB_CLIENT_ID
- GITHUB_CLIENT_SECRET

4. Install the Github app
5. Create your powerup here: [https://trello.com/power-ups/admin](https://trello.com/power-ups/admin)

- Basic Info
  - Iframe connector URL: `https://[your-glitch].glitch.me/`
  - Fill the rest out as appropriate
- Capabilities:
  - Attachment sections
  - Card badges
  - Card buttons
  - Show settings
  - Authorize status
  - Show authorization

6. Install the Powerup
7. Authorize the Github app through the Powerup Settings
