---
name: version
description: Say the version of the Jared plugin that this session has loaded, when the user asks which version of Jared or of the plugin this is. It reviews nothing and changes nothing.
allowed-tools:
  - Bash(jared-link --version)
---

# Say the version of the Jared plugin

Run `jared-link --version` with the Bash tool and tell the user what it printed: "Jared plugin" and a number, such as "Jared plugin 0.12.1".

`jared-link` is the one in the plugin's own folder, so the number is that of the plugin that this session loaded. If it says that the version cannot be read, say that, as it says it. A Jared that runs from a development server is not this plugin: its page says "dev" where a build says its number.
