if (!customElements.get("product-model")) {
  customElements.define(
    "product-model",
    class ProductModel extends DeferredMedia {
      constructor() {
        super();
      }

      loadContent() {
        super.loadContent();

        Shopify.loadFeatures([
          {
            name: "model-viewer-ui",
            version: "1.0",
            onLoad: this.setupModelViewerUI.bind(this),
          },
        ]);
      }

      setupModelViewerUI(errors) {
        if (errors) {
          return;
        }

        this.modelViewerUI = new Shopify.ModelViewerUI(
          this.querySelector("model-viewer"),
        );
      }
    },
  );
}

globalThis.ProductModel = {
  loadShopifyXR() {
    Shopify.loadFeatures([
      {
        name: "shopify-xr",
        version: "1.0",
        onLoad: this.setupShopifyXR.bind(this),
      },
    ]);
  },

  setupShopifyXR(errors) {
    if (errors) {
      return;
    }

    if (!globalThis.ShopifyXR) {
      document.addEventListener("shopify_xr_initialized", () =>
        this.setupShopifyXR(),
      );
      return;
    }

    document.querySelectorAll('[id^="ProductJSON-"]').forEach((modelJSON) => {
      globalThis.ShopifyXR.addModels(JSON.parse(modelJSON.textContent));
      modelJSON.remove();
    });
    globalThis.ShopifyXR.setupXRElements();
  },
};

globalThis.addEventListener("DOMContentLoaded", () => {
  if (globalThis.ProductModel) {
    globalThis.ProductModel.loadShopifyXR();
  }
});
