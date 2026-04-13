const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sections = document.querySelectorAll(".panel-section");
const logoutBtn = document.getElementById("logoutBtn");

const navDashboard = document.getElementById("navDashboard");
const navCategories = document.getElementById("navCategories");
const navProducts = document.getElementById("navProducts");
const navButtons = [navDashboard, navCategories, navProducts].filter(Boolean);

const loginForm = document.getElementById("loginForm");
const categoryForm = document.getElementById("categoryForm");
const productForm = document.getElementById("productForm");

const categoriesList = document.getElementById("categoriesList");
const productsList = document.getElementById("productsList");
const productCategory = document.getElementById("productCategory");

const totalProducts = document.getElementById("totalProducts");
const totalCategories = document.getElementById("totalCategories");
const totalPromos = document.getElementById("totalPromos");
const totalFeatured = document.getElementById("totalFeatured");

const toast = document.getElementById("toast");

let currentCategories = [];
let currentProducts = [];
let editingProductId = null;
let editingCategoryId = null;

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function setActiveSection(sectionId) {
  sections.forEach((section) => section.classList.remove("active"));
  navButtons.forEach((btn) => btn.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) section.classList.add("active");

  const activeButton = navButtons.find((btn) => btn.dataset.section === sectionId);
  if (activeButton) activeButton.classList.add("active");
}

function bindMenuButtons() {
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;
      if (target) setActiveSection(target);
    });
  });
}

function setLoggedInUI(isLoggedIn) {
  navButtons.forEach((btn) => btn.classList.toggle("hidden", !isLoggedIn));
  logoutBtn.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    setActiveSection("dashboard-section");
    ensureImportButton();
  } else {
    setActiveSection("login-section");
  }
}

async function uploadProductImage(file, slug) {
  if (!file) return null;

  const ext = file.name.split(".").pop();
  const filePath = `${slug}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("products")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabaseClient.storage.from("products").getPublicUrl(filePath);
  return data.publicUrl;
}

function renderCategories() {
  categoriesList.innerHTML = "";
  productCategory.innerHTML = `<option value="">Selecione</option>`;

  currentCategories.forEach((category) => {
    const item = document.createElement("div");
    item.className = "category-item";
    item.innerHTML = `
      <h4>${category.name}</h4>
      <p>Slug: ${category.slug}</p>
      <p>Ordem: ${category.order_index}</p>
      <p>Status: ${category.active ? "Ativa" : "Inativa"}</p>
      <div class="product-meta" style="margin-top:12px">
        <button class="btn-primary" type="button" data-edit-category="${category.id}">Editar</button>
        <button class="btn-primary" type="button" data-delete-category="${category.id}" style="background:#a73131;color:#fff;">Excluir</button>
      </div>
    `;
    categoriesList.appendChild(item);

    if (category.active) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      productCategory.appendChild(option);
    }
  });

  totalCategories.textContent = String(currentCategories.length);
}

function renderProducts() {
  productsList.innerHTML = "";

  currentProducts.forEach((product) => {
    const item = document.createElement("div");
    item.className = "product-admin-item";
    item.innerHTML = `
      <img src="${product.image_url || "https://placehold.co/300x300?text=Sem+Imagem"}" alt="${product.name}">
      <div>
        <h4>${product.name}</h4>
        <p>${product.description || "Sem descrição."}</p>
        <div class="product-meta">
          <span class="meta-badge">${formatPrice(product.price)}</span>
          <span class="meta-badge">${product.categories?.name || "Sem categoria"}</span>
          ${product.sizes ? `<span class="meta-badge">${product.sizes}</span>` : ""}
          ${product.is_promo ? `<span class="meta-badge">Promoção</span>` : ""}
          ${product.is_featured ? `<span class="meta-badge">Destaque</span>` : ""}
          <span class="meta-badge">${product.active ? "Ativo" : "Inativo"}</span>
        </div>
        <div class="product-meta" style="margin-top:12px">
          <button class="btn-primary" type="button" data-edit-product="${product.id}">Editar</button>
          <button class="btn-primary" type="button" data-delete-product="${product.id}" style="background:#a73131;color:#fff;">Excluir</button>
        </div>
      </div>
    `;
    productsList.appendChild(item);
  });

  totalProducts.textContent = String(currentProducts.length);
  totalPromos.textContent = String(currentProducts.filter((p) => p.is_promo).length);
  totalFeatured.textContent = String(currentProducts.filter((p) => p.is_featured).length);
}

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    showToast("Erro ao carregar categorias.", "error");
    return;
  }

  currentCategories = data || [];
  renderCategories();
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select(`
      *,
      categories(name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Erro ao carregar produtos.", "error");
    return;
  }

  currentProducts = data || [];
  renderProducts();
}

async function refreshAll() {
  await loadCategories();
  await loadProducts();
}

function resetCategoryForm() {
  editingCategoryId = null;
  categoryForm.reset();
  document.getElementById("categoryOrder").value = "0";
  document.getElementById("categoryActive").checked = true;
  categoryForm.querySelector("button[type='submit']").textContent = "Salvar categoria";
}

function resetProductForm() {
  editingProductId = null;
  productForm.reset();
  document.getElementById("productActive").checked = true;
  productForm.querySelector("button[type='submit']").textContent = "Salvar produto";
}

function ensureImportButton() {
  const dashboardSection = document.getElementById("dashboard-section");
  if (!dashboardSection) return;

  let existing = document.getElementById("seedProductsBtn");
  if (existing) return;

  const wrap = document.createElement("div");
  wrap.style.marginTop = "24px";
  wrap.innerHTML = `
    <button id="seedProductsBtn" class="btn-primary" type="button">
      Importar produtos atuais do site
    </button>
  `;
  dashboardSection.appendChild(wrap);

  document.getElementById("seedProductsBtn").addEventListener("click", seedInitialProducts);
}

async function seedInitialProducts() {
  try {
    const { data: existingProducts } = await supabaseClient.from("products").select("slug");
    const existingSlugs = new Set((existingProducts || []).map((p) => p.slug));

    const categoryMap = {};
    currentCategories.forEach((c) => {
      categoryMap[c.slug] = c.id;
    });

    const productsToInsert = [
      {
        name: "Conjunto Atena",
        slug: "conjunto-atena",
        price: 140,
        image_url: "images/conjunto-atena.jpg",
        category_id: categoryMap["conjuntos-com-calca"] || null,
        sizes: "P/M/G",
        description: "Conjunto com calça.",
        is_promo: false,
        is_featured: true,
        active: true,
      },
      {
        name: "Conjunto Lia",
        slug: "conjunto-lia",
        price: 140,
        image_url: "images/conjunto-lia.jpg",
        category_id: categoryMap["conjuntos-com-calca"] || null,
        sizes: "P/M/G",
        description: "Conjunto com calça.",
        is_promo: false,
        is_featured: false,
        active: true,
      },
      {
        name: "Conjunto Zayra",
        slug: "conjunto-zayra",
        price: 140,
        image_url: "images/conjunto-zayra.jpg",
        category_id: categoryMap["conjuntos-com-calca"] || null,
        sizes: "P/M/G",
        description: "Conjunto com calça.",
        is_promo: false,
        is_featured: false,
        active: true,
      },
      {
        name: "Conjunto Lua",
        slug: "conjunto-lua",
        price: 140,
        image_url: "images/conjunto-lua.jpg",
        category_id: categoryMap["conjuntos-com-calca"] || null,
        sizes: "M/G/GG",
        description: "Conjunto com calça.",
        is_promo: false,
        is_featured: false,
        active: true,
      },
      {
        name: "Aura + Shorts",
        slug: "aura-shorts",
        price: 120,
        image_url: "images/aura-shorts.jpg",
        category_id: categoryMap["conjuntos-com-bermuda"] || null,
        sizes: "P/M/G",
        description: "Conjunto com bermuda.",
        is_promo: false,
        is_featured: false,
        active: true,
      },
      {
        name: "Shorts Colete",
        slug: "shorts-colete",
        price: 120,
        image_url: "images/shorts-colete.jpg",
        category_id: categoryMap["conjuntos-com-bermuda"] || null,
        sizes: "P/M/G/GG",
        description: "Conjunto com bermuda.",
        is_promo: false,
        is_featured: true,
        active: true,
      },
    ].filter((item) => !existingSlugs.has(item.slug));

    if (!productsToInsert.length) {
      showToast("Os produtos atuais já foram importados.");
      return;
    }

    const { error } = await supabaseClient.from("products").insert(productsToInsert);
    if (error) throw error;

    showToast("Produtos importados com sucesso.");
    await loadProducts();
  } catch (err) {
    showToast(err.message || "Erro ao importar produtos.", "error");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    showToast(error.message || "Erro ao entrar.", "error");
    return;
  }

  showToast("Login realizado com sucesso.");
  setLoggedInUI(true);
  await refreshAll();
});

logoutBtn.addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showToast("Erro ao sair.", "error");
    return;
  }

  resetCategoryForm();
  resetProductForm();
  setLoggedInUI(false);
  showToast("Você saiu do painel.");
});

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("categoryName").value.trim();
  const slug = document.getElementById("categorySlug").value.trim() || slugify(name);
  const orderIndex = Number(document.getElementById("categoryOrder").value || 0);
  const active = document.getElementById("categoryActive").checked;

  if (editingCategoryId) {
    const { error } = await supabaseClient
      .from("categories")
      .update({ name, slug, order_index: orderIndex, active })
      .eq("id", editingCategoryId);

    if (error) {
      showToast(error.message || "Erro ao atualizar categoria.", "error");
      return;
    }

    showToast("Categoria atualizada com sucesso.");
  } else {
    const { error } = await supabaseClient.from("categories").insert([
      { name, slug, order_index: orderIndex, active }
    ]);

    if (error) {
      showToast(error.message || "Erro ao salvar categoria.", "error");
      return;
    }

    showToast("Categoria salva com sucesso.");
  }

  resetCategoryForm();
  await loadCategories();
});

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("productName").value.trim();
  const slug = document.getElementById("productSlug").value.trim() || slugify(name);
  const price = Number(document.getElementById("productPrice").value || 0);
  const categoryId = document.getElementById("productCategory").value || null;
  const sizes = document.getElementById("productSizes").value.trim();
  const description = document.getElementById("productDescription").value.trim();
  const isPromo = document.getElementById("productPromo").checked;
  const isFeatured = document.getElementById("productFeatured").checked;
  const active = document.getElementById("productActive").checked;
  const imageFile = document.getElementById("productImage").files[0];

  try {
    let imageUrl = null;

    if (editingProductId) {
      const current = currentProducts.find((p) => p.id === editingProductId);
      imageUrl = current?.image_url || null;
    }

    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile, slug);
    }

    const payload = {
      name,
      slug,
      price,
      image_url: imageUrl,
      category_id: categoryId,
      sizes,
      description,
      is_promo: isPromo,
      is_featured: isFeatured,
      active,
    };

    if (editingProductId) {
      const { error } = await supabaseClient
        .from("products")
        .update(payload)
        .eq("id", editingProductId);

      if (error) {
        showToast(error.message || "Erro ao atualizar produto.", "error");
        return;
      }

      showToast("Produto atualizado com sucesso.");
    } else {
      const { error } = await supabaseClient.from("products").insert([payload]);

      if (error) {
        showToast(error.message || "Erro ao salvar produto.", "error");
        return;
      }

      showToast("Produto salvo com sucesso.");
    }

    resetProductForm();
    await loadProducts();
  } catch (err) {
    showToast(err.message || "Erro ao enviar imagem.", "error");
  }
});

categoriesList.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-category]");
  const deleteBtn = e.target.closest("[data-delete-category]");

  if (editBtn) {
    const id = editBtn.dataset.editCategory;
    const category = currentCategories.find((c) => c.id === id);
    if (!category) return;

    editingCategoryId = category.id;
    document.getElementById("categoryName").value = category.name || "";
    document.getElementById("categorySlug").value = category.slug || "";
    document.getElementById("categoryOrder").value = category.order_index ?? 0;
    document.getElementById("categoryActive").checked = !!category.active;
    categoryForm.querySelector("button[type='submit']").textContent = "Atualizar categoria";
    setActiveSection("category-section");
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteCategory;
    if (!confirm("Deseja excluir esta categoria?")) return;

    const { error } = await supabaseClient.from("categories").delete().eq("id", id);
    if (error) {
      showToast(error.message || "Erro ao excluir categoria.", "error");
      return;
    }

    showToast("Categoria removida com sucesso.");
    await loadCategories();
  }
});

productsList.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-product]");
  const deleteBtn = e.target.closest("[data-delete-product]");

  if (editBtn) {
    const id = editBtn.dataset.editProduct;
    const product = currentProducts.find((p) => p.id === id);
    if (!product) return;

    editingProductId = product.id;
    document.getElementById("productName").value = product.name || "";
    document.getElementById("productSlug").value = product.slug || "";
    document.getElementById("productPrice").value = product.price ?? "";
    document.getElementById("productCategory").value = product.category_id || "";
    document.getElementById("productSizes").value = product.sizes || "";
    document.getElementById("productDescription").value = product.description || "";
    document.getElementById("productPromo").checked = !!product.is_promo;
    document.getElementById("productFeatured").checked = !!product.is_featured;
    document.getElementById("productActive").checked = !!product.active;
    productForm.querySelector("button[type='submit']").textContent = "Atualizar produto";
    setActiveSection("product-section");
    return;
  }

  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteProduct;
    if (!confirm("Deseja excluir este produto?")) return;

    const { error } = await supabaseClient.from("products").delete().eq("id", id);
    if (error) {
      showToast(error.message || "Erro ao excluir produto.", "error");
      return;
    }

    showToast("Produto removido com sucesso.");
    await loadProducts();
  }
});

document.getElementById("categoryName").addEventListener("input", (e) => {
  document.getElementById("categorySlug").value = slugify(e.target.value);
});

document.getElementById("productName").addEventListener("input", (e) => {
  document.getElementById("productSlug").value = slugify(e.target.value);
});

async function checkSession() {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    setLoggedInUI(true);
    await refreshAll();
  } else {
    setLoggedInUI(false);
  }
}

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  if (session) {
    setLoggedInUI(true);
    await refreshAll();
  } else {
    setLoggedInUI(false);
  }
});

bindMenuButtons();
checkSession();