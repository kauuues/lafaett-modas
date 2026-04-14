window.addEventListener("DOMContentLoaded", () => {
  const menuToggle = document.getElementById("menu-toggle");
  const menu = document.getElementById("menu");

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", () => {
      menu.classList.toggle("active");
    });

    const menuLinks = menu.querySelectorAll("a");
    menuLinks.forEach((link) => {
      link.addEventListener("click", () => {
        menu.classList.remove("active");
      });
    });
  }

  const SUPABASE_URL = window.SUPABASE_URL;
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
  const WHATSAPP_NUMBER = window.WHATSAPP_NUMBER;

  const productGrid = document.getElementById("productGrid");
  const dynamicCategories = document.getElementById("dynamicCategories");
  const categoryGrid = document.getElementById("categoryGrid");

  function revealOnScroll() {
    const reveals = document.querySelectorAll(".reveal");
    const trigger = window.innerHeight * 0.88;

    reveals.forEach((element) => {
      const top = element.getBoundingClientRect().top;
      if (top < trigger) {
        element.classList.add("visible");
      }
    });
  }

  window.addEventListener("scroll", revealOnScroll);
  window.addEventListener("load", revealOnScroll);

  function formatPrice(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function buildWhatsAppLink(productName) {
    const text = encodeURIComponent(
      `Olá! Tenho interesse no produto ${productName} da Lafaett Modas.`
    );
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
  }

  function buildBadge(product) {
    if (product.is_featured) return "Destaque";
    if (product.is_promo) return "Promoção";
    return "Novo";
  }

  function renderCategoryMenu(categories) {
    if (!categoryGrid) return;

    const activeCategories = categories.filter((category) => category.active);

    categoryGrid.innerHTML = activeCategories
      .map((category) => {
        return `
          <a href="#${category.slug}" class="category-card">${category.name}</a>
        `;
      })
      .join("");
  }

  function renderCategorySections(categories, products) {
    if (!dynamicCategories) return;

    const activeCategories = categories.filter((category) => category.active);

    dynamicCategories.innerHTML = activeCategories
      .map((category) => {
        const categoryProducts = products.filter(
          (product) => product.category_id === category.id
        );

        if (!categoryProducts.length) return "";

        return `
          <section class="products" id="${category.slug}">
            <div class="container">
              <div class="section-top reveal">
                <div>
                  <span class="section-label">Categoria</span>
                  <h3>${category.name}</h3>
                </div>
                <p>Peças cadastradas nesta categoria.</p>
              </div>

              <div class="product-grid">
                ${categoryProducts
                  .map(
                    (product) => `
                      <article class="product-card reveal">
                        <div class="product-image-wrap">
                          <span class="product-badge">${buildBadge(product)}</span>
                          <img
                            src="${product.image_url || "https://placehold.co/600x800?text=Sem+Imagem"}"
                            alt="${product.name}"
                          />
                        </div>
                        <div class="product-info">
                          <span>${category.name}</span>
                          <h4>${product.name}</h4>
                          ${product.price ? `<strong>${formatPrice(product.price)}</strong>` : ""}
                          <a
                            class="btn btn-primary"
                            href="${buildWhatsAppLink(product.name)}"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Tenho interesse
                          </a>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </div>
          </section>
        `;
      })
      .join("");
  }

  function renderAllProducts(products) {
    if (!productGrid) return;

    productGrid.innerHTML = products
      .map(
        (product) => `
          <article class="product-card reveal">
            <div class="product-image-wrap">
              <span class="product-badge">${buildBadge(product)}</span>
              <img
                src="${product.image_url || "https://placehold.co/600x800?text=Sem+Imagem"}"
                alt="${product.name}"
              />
            </div>
            <div class="product-info">
              <span>${product.categories?.name || "Catálogo"}</span>
              <h4>${product.name}</h4>
              ${product.price ? `<strong>${formatPrice(product.price)}</strong>` : ""}
              <a
                class="btn btn-primary"
                href="${buildWhatsAppLink(product.name)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Tenho interesse
              </a>
            </div>
          </article>
        `
      )
      .join("");

    setTimeout(() => {
      revealOnScroll();
    }, 100);
  }

  async function loadCatalog() {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Credenciais do Supabase não encontradas.");
      return;
    }

    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    try {
      const { data: categories, error: categoriesError } = await supabaseClient
        .from("categories")
        .select("*")
        .eq("active", true)
        .order("order_index", { ascending: true });

      if (categoriesError) throw categoriesError;

      const { data: products, error: productsError } = await supabaseClient
        .from("products")
        .select(`
          *,
          categories(name)
        `)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (productsError) throw productsError;

      renderCategoryMenu(categories || []);
      renderCategorySections(categories || [], products || []);
      renderAllProducts(products || []);
      revealOnScroll();
    } catch (error) {
      console.error("Erro ao carregar catálogo:", error);

      if (productGrid) {
        productGrid.innerHTML = `
          <p style="color:#cfae66;">Não foi possível carregar os produtos agora.</p>
        `;
      }
    }
  }

  loadCatalog();
});