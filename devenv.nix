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
# Adding env variable for store URL so I don't have to use url flag with Shopify CLI
  env = {
    SHOPIFY_FLAG_STORE = "skio-launch-testing.myshopify.com";
  };
  # See full reference at https://devenv.sh/reference/options/
}

