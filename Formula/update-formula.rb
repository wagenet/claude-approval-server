#!/usr/bin/env ruby
# Usage: ruby Formula/update-formula.rb VERSION SHA_ARM SHA_X64
# Rewrites version, arm64 sha256, and x86_64 sha256 in the formula.

version, sha_arm, sha_x64 = ARGV

abort "Usage: update-formula.rb VERSION SHA_ARM SHA_X64" unless version && sha_arm && sha_x64

formula_path = File.join(__dir__, "claude-approval-server.rb")
content = File.read(formula_path)

# Strip leading 'v' if present
version = version.sub(/^v/, "")

content.gsub!(/version ".*?"/, %(version "#{version}"))

# Update URLs
content.gsub!(
  %r{https://github\.com/wagenet/claude-approval-server/releases/download/v[^/]+/claude-approval-server-macos-arm64},
  "https://github.com/wagenet/claude-approval-server/releases/download/v#{version}/claude-approval-server-macos-arm64"
)
content.gsub!(
  %r{https://github\.com/wagenet/claude-approval-server/releases/download/v[^/]+/claude-approval-server-macos-x86_64},
  "https://github.com/wagenet/claude-approval-server/releases/download/v#{version}/claude-approval-server-macos-x86_64"
)

# Update sha256 values — arm64 comes first in the file
shas = [sha_arm, sha_x64]
i = 0
content.gsub!(/sha256 "[a-f0-9]+"/) do
  result = %(sha256 "#{shas[i]}")
  i += 1
  result
end

File.write(formula_path, content)
puts "Updated #{formula_path} to v#{version}"
