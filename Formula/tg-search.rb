class TgSearch < Formula
  desc "Local-first Telegram search CLI and persistent daemon"
  homepage "https://github.com/groupultra/telegram-search"
  url "https://github.com/groupultra/telegram-search/releases/download/v1.3.3/tg-search-cli-1.3.3.tgz"
  sha256 "dea802ddfcc05b9ff6c5287a38d1c70ce7824389bd1da2ce45f7ae64d9f27a95"
  license "AGPL-3.0-only"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    (bin/"tg-search").write_env_script libexec/"bin/tg-search", PATH: "#{Formula["node"].opt_bin}:$PATH"

    # Keep logs beside the user's profile so the daemon's rotation applies.
    # launchd does not expand $HOME in its stdout/stderr path fields.
    (libexec/"tg-search-service").write <<~SH
      #!/bin/sh
      set -eu
      umask 077
      if [ -n "${TG_SEARCH_HOME:-}" ]; then
        data_root="$TG_SEARCH_HOME"
      elif [ "$(uname -s)" = "Darwin" ]; then
        data_root="$HOME/Library/Application Support/telegram-search"
      else
        data_root="${XDG_DATA_HOME:-$HOME/.local/share}/telegram-search"
      fi
      profile_root="$data_root/profiles/default"
      mkdir -p "$profile_root"
      exec "#{opt_bin}/tg-search" --profile default daemon run >>"$profile_root/daemon.stdout.log" 2>>"$profile_root/daemon.stderr.log"
    SH
    chmod 0755, libexec/"tg-search-service"
  end

  service do
    run opt_libexec/"tg-search-service"
    keep_alive true
    environment_variables PATH: std_service_path_env
  end

  def caveats
    <<~EOS
      Configure and log in to the default profile before starting the service:
        tg-search profile configure --apiId YOUR_API_ID --apiHash YOUR_API_HASH
        tg-search auth login
        brew services start groupultra/telegram-search/tg-search
      The service uses your default profile and its existing data directory.
      Run brew services as your user, without sudo.
    EOS
  end

  test do
    ENV["TG_SEARCH_HOME"] = testpath/"data"
    system bin/"tg-search", "profile", "create", "brew-test"
    assert_path_exists testpath/"data/profiles/brew-test/exports"
    assert_match '"brew-test"', shell_output("#{bin}/tg-search profile list")
    assert_match '"state":"stopped"', shell_output("#{bin}/tg-search --profile brew-test daemon status").delete(" \n")
  end
end
