{
  pkgs,
  lib,
  config,
  ...
}:
{
  # https://devenv.sh/languages/
  languages = {
    javascript = {
      enable = true;
      npm = {
        enable = true;
        install.enable = true;
      };
    };
  };

  # https://devenv.sh/packages/
  packages = [
    pkgs.shopify-cli
  ];

  # https://devenv.sh/git-hooks/
  git-hooks = {
    enable = true;
    hooks = {
      eslint.enable = true;
      prettier.enable = true;
    };
  };

  # See full reference at https://devenv.sh/reference/options/
}

