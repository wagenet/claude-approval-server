class ClaudeApprovalServer < Formula
  desc "Approval server for Claude Code hooks"
  homepage "https://github.com/wagenet/claude-approval-server"
  version "0.1.0"

  on_arm do
    url "https://github.com/wagenet/claude-approval-server/releases/download/v0.1.0/claude-approval-server-macos-arm64"
    sha256 "placeholder_arm64_sha256"
  end

  on_intel do
    url "https://github.com/wagenet/claude-approval-server/releases/download/v0.1.0/claude-approval-server-macos-x86_64"
    sha256 "placeholder_x86_64_sha256"
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
