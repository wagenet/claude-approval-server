# Changelog

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
