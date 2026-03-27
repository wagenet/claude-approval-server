class ClaudeApprovalServer < Formula
  desc "Approval server for Claude Code hooks"
  homepage "https://github.com/wagenet/claude-approval-server"
  version "1.2.0"

  on_arm do
    url "https://github.com/wagenet/claude-approval-server/releases/download/v1.2.0/claude-approval-server-macos-arm64"
    sha256 "302ce5443f5b3b3a69de717404d3eb265eb9dcfa50aff6983ce71eb61ffaaab2"
  end

  on_intel do
    url "https://github.com/wagenet/claude-approval-server/releases/download/v1.2.0/claude-approval-server-macos-x86_64"
    sha256 "4f30f862b0cf2104dfceac865762de54614ea1f2f769e28e12ea39f596978610"
  end

  def install
    bin.install "claude-approval-server-macos-arm64" => "claude-approval-server" if Hardware::CPU.arm?
    bin.install "claude-approval-server-macos-x86_64" => "claude-approval-server" if Hardware::CPU.intel?
  end

  service do
    run [opt_bin/"claude-approval-server", "serve"]
    keep_alive true
    log_path "/tmp/claude-approval.log"
    error_log_path "/tmp/claude-approval.error.log"
    environment_variables HOME: ENV["HOME"]
  end

  def post_install
    # Automatically configure Claude Code hooks on install and upgrade.
    # Idempotent — safe to run multiple times.
    system bin/"claude-approval-server", "install-hooks"
  end

  def uninstall
    # Remove Claude Code hooks and shim before the binary is deleted.
    system bin/"claude-approval-server", "uninstall"
  end

  def caveats
    <<~EOS
      Claude Code hooks were configured automatically.
      Restart Claude Code for hook changes to take effect.
    EOS
  end
end
