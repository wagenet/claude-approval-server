# Changelog

## [1.1.0](https://github.com/wagenet/claude-approval-server/compare/v1.0.0...v1.1.0) (2026-03-24)


### Features

* add dismiss button to release hook hold without deciding ([5670d37](https://github.com/wagenet/claude-approval-server/commit/5670d37f1a9309fb5a1f52a0bc6b6606d143dc82))
* add GET /log endpoint with in-memory payload ring buffer ([f8ccd27](https://github.com/wagenet/claude-approval-server/commit/f8ccd27f7d1a5781c04e436dcb86b433371681c0))
* add SwiftBar menu bar plugin and install-swiftbar command ([7b75a37](https://github.com/wagenet/claude-approval-server/commit/7b75a37088ba4b712e40c8cc7d3f7f429f4e2377))
* convert frontend to Ember 6 + Embroider + Vite ([3dc62ea](https://github.com/wagenet/claude-approval-server/commit/3dc62ea012243d135314fb077a5c2da33244e3df))
* convert frontend to Ember 6 + Embroider + Vite ([5aa2d30](https://github.com/wagenet/claude-approval-server/commit/5aa2d3048a819e1d9ddd6c0c1da597b28d41b6c8))
* surface session name in UI cards ([b4e14b7](https://github.com/wagenet/claude-approval-server/commit/b4e14b707d14dc6efe2eb76fec08254806fc5521))
* **ui:** add option to disable notifications; note macOS requireInteraction limitation ([4134fc0](https://github.com/wagenet/claude-approval-server/commit/4134fc0f6a47528f08548baa03eb660e8a62bbf6))
* **ui:** detect interpreter in heredoc for syntax highlighting ([0423f15](https://github.com/wagenet/claude-approval-server/commit/0423f15ebfdc51c66c922668859c776549d97bcc))
* **ui:** indent pipe segments deeper than && in bash display ([c0fa1e2](https://github.com/wagenet/claude-approval-server/commit/c0fa1e2ec2a3d2706e33760f64ebe61f26a1ac1c))
* **ui:** split bash commands on semicolons ([d94a69e](https://github.com/wagenet/claude-approval-server/commit/d94a69e107bf4fd45a2cf7acefeb17edb971cf14))
* **ui:** structured display for git commit commands ([876c1e9](https://github.com/wagenet/claude-approval-server/commit/876c1e97aa9b8504418979a3e0d6184725456540))
* **ui:** syntax-highlight node -e and compound cd && node -e commands ([b29ffd1](https://github.com/wagenet/claude-approval-server/commit/b29ffd13937c169b7ea3f7c8cd6f74373be699b7))


### Bug Fixes

* address review findings on Ember frontend ([afb17dd](https://github.com/wagenet/claude-approval-server/commit/afb17dd9271752269c1b7b35b4b8f64a511969e2))
* bind server and Vite dev to all interfaces for LAN access ([95b118c](https://github.com/wagenet/claude-approval-server/commit/95b118ce0d9810a095ae70ace69334a95de3a02b))
* **explain:** show explanation in card and suppress spurious idle session ([af33d3a](https://github.com/wagenet/claude-approval-server/commit/af33d3ad94a6a8cd7c53fc99df743af028f4e68a))
* **explain:** use --effort low for claude -p subprocess ([e477edf](https://github.com/wagenet/claude-approval-server/commit/e477edf82a323b7bce38e526a0411646b0bf8aee))
* **frontend:** bundle highlight.js CSS via JS import instead of CSS [@import](https://github.com/import) url() ([c90ac10](https://github.com/wagenet/claude-approval-server/commit/c90ac10fa049506c1dfd9bd2911062e961b0a843))
* **frontend:** guard Notification API for iOS Safari ([3288163](https://github.com/wagenet/claude-approval-server/commit/328816309a8da7a900b9a8e7b1293c3beae5b368))
* **frontend:** import highlight.js CSS from app.ts instead of app.css ([817a6ed](https://github.com/wagenet/claude-approval-server/commit/817a6ed7cfed3e37b64d08ec07ba0b4336306301))
* **frontend:** improve card layout on narrow/mobile viewports ([75dea22](https://github.com/wagenet/claude-approval-server/commit/75dea22a293633525aa0f659d7a4211477f40468))
* **frontend:** render git commit body as markdown ([3d6fe3f](https://github.com/wagenet/claude-approval-server/commit/3d6fe3f65d6bc0f388f780ba3fdb3cc3df4d6590))
* **frontend:** restore correct highlight.js CSS cascade and code block structure ([feecda6](https://github.com/wagenet/claude-approval-server/commit/feecda68d68b2875968293a6033c50a7a0b4a9f9))
* **frontend:** split card header into three rows for narrow windows ([d30142f](https://github.com/wagenet/claude-approval-server/commit/d30142f72d734c3a52a4500590cb970a35102361))
* **lint:** wire up frontend linting from root and fix all lint errors ([36ebbad](https://github.com/wagenet/claude-approval-server/commit/36ebbad21c1e4bd3d742ae7b297ee21d9fbd7c48))
* make release process work with Ember frontend ([7769451](https://github.com/wagenet/claude-approval-server/commit/77694515e8912e7dd2ea75e1db494d88f4f15b67))
* remove duplicate private key in frontend/package.json ([62fc113](https://github.com/wagenet/claude-approval-server/commit/62fc113abc2f15281a8e74bb05108af43c6f3fb7))
* **routes:** forward custom deny message to hook response ([ff74e37](https://github.com/wagenet/claude-approval-server/commit/ff74e3752df2f19a83affcac6718bfd7349ba4d1))
* **server:** resolve pending entries on SIGTERM/SIGINT ([9d41363](https://github.com/wagenet/claude-approval-server/commit/9d41363ad9ff1727211a70a717fa2b9971accf31))
* **swiftbar:** migrate .vars.json when renaming plugin ([cb0542c](https://github.com/wagenet/claude-approval-server/commit/cb0542c6ca8a8e9768608e64337c33b71eb5e8ab))
* **swiftbar:** refresh every 5s and show icon when server is down ([910c09f](https://github.com/wagenet/claude-approval-server/commit/910c09f19da388e8334b220e2e02a45d33d18cdb))
* **swiftbar:** show pending count as filled badge emoji in menu bar ([0151a11](https://github.com/wagenet/claude-approval-server/commit/0151a111927cecdf4cb7cc9ed4a07b8f322f00f0))
* **ui-utils:** handle heredoc formatting in Bash cards ([9d46e37](https://github.com/wagenet/claude-approval-server/commit/9d46e37c5878dc0a29920aa33cd4d2acd553ce05))
* **ui:** detect git commit with -C flag in parseGitCommit ([ea28570](https://github.com/wagenet/claude-approval-server/commit/ea285700a34685f5b6c9230407cd94a471e86fa2))
* **ui:** detect python3 -c with trailing redirections/pipes ([9e7a041](https://github.com/wagenet/claude-approval-server/commit/9e7a041cf6ce8ad762cd89e30e9dca8340bef096))
* **ui:** handle lowercase MCP tool names from hook payload ([1016352](https://github.com/wagenet/claude-approval-server/commit/101635205d070c7115d6cc99451ec837888e4877))
* **ui:** make filename more prominent in file-path label ([956b9e2](https://github.com/wagenet/claude-approval-server/commit/956b9e28b3e43756ea258df5ade6057fb0f58856))
* **ui:** remove meaningless void operators on synchronous notify calls ([a56fb09](https://github.com/wagenet/claude-approval-server/commit/a56fb09779933ea94a4346b057c074827da3cdf8))
* **ui:** show Bash description, Grep options, and fix seps type ([174a1fc](https://github.com/wagenet/claude-approval-server/commit/174a1fcd95286d84c7b2b03493f501d4751b30a2))
* **ui:** show plan text in ExitPlanMode card code block ([0e5bf64](https://github.com/wagenet/claude-approval-server/commit/0e5bf644c2646f3219abcc8e1f6afbff4ccf5b67))
* **ui:** split && operators onto new lines in Bash command display ([e83d26c](https://github.com/wagenet/claude-approval-server/commit/e83d26c35469626eb7309f3dd62d07f66dc2c4ee))
* **ui:** split PascalCase tool names into words for readability ([8800ccc](https://github.com/wagenet/claude-approval-server/commit/8800ccc49d2aa9e822dd1afb69314481aad7916f))
* **ui:** tone down links in idle output cards ([30bb4af](https://github.com/wagenet/claude-approval-server/commit/30bb4af9658ec285077b4feffc4749f92775be77))
* **ui:** use formatToolName for plan modal badge ([e24af31](https://github.com/wagenet/claude-approval-server/commit/e24af3145a4c41d3092bac3af1b6975cde09526b))
* **utils:** sanitize AppleScript interpolations in buildFocusScript ([d1e6223](https://github.com/wagenet/claude-approval-server/commit/d1e622374da87d6490aa32ea6b037efc431d9db0))

## 1.0.0 (2026-03-18)


### Features

* **routes:** auto-expire idle sessions after 24 hours ([b30171d](https://github.com/wagenet/claude-approval-server/commit/b30171dd958ee66c65d84de03c603ecfafc8a97e))
* support PORT env var to override default port 4759 ([fb5b998](https://github.com/wagenet/claude-approval-server/commit/fb5b998dc7df491021462ca578bb86b1ba04b325))
* **ui:** display MCP tool names in human-readable format ([85d642e](https://github.com/wagenet/claude-approval-server/commit/85d642eeda076bb2bafba76ea4fd61e3f1b4ef9e))


### Bug Fixes

* **routes:** log malformed JSONL lines during transcript parsing ([dc02245](https://github.com/wagenet/claude-approval-server/commit/dc02245c6987c41b105db5600d38448a80c42cfd))
* **settings:** serialize concurrent saves to prevent data loss ([0fc1616](https://github.com/wagenet/claude-approval-server/commit/0fc1616681dada3758595896edaff20be2d18065))
* **utils:** escape cwd in Ghostty AppleScript to prevent path injection ([532ac7e](https://github.com/wagenet/claude-approval-server/commit/532ac7ea88ecd12d0683b3feddac5da13ae5a09f))


### Performance Improvements

* **ui:** unify queue and idle polling into a single interval ([513095a](https://github.com/wagenet/claude-approval-server/commit/513095a3fec0b93195a56444f2d6394a06504afd))
