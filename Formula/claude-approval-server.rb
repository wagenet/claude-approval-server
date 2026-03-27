class ClaudeApprovalServer < Formula
  desc "Approval server for Claude Code hooks"
  homepage "https://github.com/wagenet/claude-approval-server"
  version "1.3.0"

  on_arm do
    url "https://github.com/wagenet/claude-approval-server/releases/download/v1.3.0/claude-approval-server-macos-arm64"
    sha256 "1b34b0edd74b242d22923c7ce3ee231a3c3664d99f28c244c16e0cb0729d0e83"
  end

  on_intel do
    url "https://github.com/wagenet/claude-approval-server/releases/download/v1.3.0/claude-approval-server-macos-x86_64"
    sha256 "d48b12d38babbfef16e46a06aa45f562ae84413383ad5f86c70caf53d3f74564"
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

  def caveats
    <<~EOS
      Run the following to configure Claude Code hooks:
        claude-approval-server install-hooks

      To remove hooks before uninstalling:
        claude-approval-server uninstall

      Restart Claude Code for hook changes to take effect.
    EOS
  end
end
