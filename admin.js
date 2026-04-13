const SUPABASE_URL = window.SUPABASE_URL;
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sections = document.querySelectorAll(".panel-section");
const navButtons = document.querySelectorAll(".nav-btn");
const logoutBtn = document.getElementById("logoutBtn");

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
  sections.forEach((section) => {
    section.classList.remove("active");
  });

  navButtons.forEach((btn) => {
    btn.classList.remove("active");
  });

  const targetSection = document.getElementById(sectionId);
  if (targetSection) targetSection.classList.add("active");

  const activeBtn = [...navButtons].find((btn) => btn.dataset.section === sectionId);
  if (activeBtn) activeBtn.classList.add("active");
}

function setLoggedInUI(isLoggedIn) {
  logoutBtn.classList.toggle("hidden", !isLoggedIn);

  if (isLoggedIn) {
    setActiveSection("dashboard-section");
  } else {
    setActiveSection("login-section");
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.section !== "login-section") {
      setActiveSection(btn.dataset.section);
    } else {
      setActiveSection("login-section");
    }
  });
});

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

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabaseClient.storage.from("products").getPublicUrl(filePath);
  return data.publicUrl;
}

async function loadCategories() {
  const { data, error } = await supabaseClient
    .from("categories")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    showToast("Erro ao carregar categorias.", "error");
    return [];
  }

  categoriesList.innerHTML = "";

  productCategory.innerHTML = `<option value="">Selecione</option>`;

  data.forEach((category) => {
    const item = document.createElement("div");
    item.className = "category-item";
    item.innerHTML = `
      <h4>${category.name}</h4>
      <p>Slug: ${category.slug}</p>
      <p>Ordem: ${category.order_index}</p>
      <p>Status: ${category.active ? "Ativa" : "Inativa"}</p>
    `;
    categoriesList.appendChild(item);

    if (category.active) {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      productCategory.appendChild(option);
    }
  });

  totalCategories.textContent = String(data.length);
  return data;
}

async function loadProducts() {
  const { data, error } = await supabaseClient
    .from("products")
    .select(`
      *,
      categories (
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    showToast("Erro ao carregar produtos.", "error");
    return [];
  }

  productsList.innerHTML = "";

  data.forEach((product) => {
    const item = document.createElement("div");
    item.className = "product-admin-item";

    item.innerHTML = `
      <img src="${product.image_url || "https://placehold.co/300x300?text=Sem+Imagem"}" alt="${product.name}" />
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
      </div>
    `;

    productsList.appendChild(item);
  });

  totalProducts.textContent = String(data.length);
  totalPromos.textContent = String(data.filter((item) => item.is_promo).length);
  totalFeatured.textContent = String(data.filter((item) => item.is_featured).length);

  return data;
}

async function refreshDashboard() {
  await loadCategories();
  await loadProducts();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showToast(error.message || "Erro ao entrar.", "error");
    return;
  }

  showToast("Login realizado com sucesso.");
  setLoggedInUI(true);
  await refreshDashboard();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  setLoggedInUI(false);
  showToast("Você saiu do painel.");
});

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("categoryName").value.trim();
  const slugInput = document.getElementById("categorySlug").value.trim();
  const orderIndex = Number(document.getElementById("categoryOrder").value || 0);
  const active = document.getElementById("categoryActive").checked;

  const slug = slugInput || slugify(name);

  const { error } = await supabaseClient.from("categories").insert([
    {
      name,
      slug,
      order_index: orderIndex,
      active,
    },
  ]);

  if (error) {
    showToast(error.message || "Erro ao salvar categoria.", "error");
    return;
  }

  categoryForm.reset();
  document.getElementById("categoryOrder").value = "0";
  document.getElementById("categoryActive").checked = true;

  showToast("Categoria salva com sucesso.");
  await loadCategories();
});

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("productName").value.trim();
  const slugInput = document.getElementById("productSlug").value.trim();
  const price = Number(document.getElementById("productPrice").value || 0);
  const categoryId = document.getElementById("productCategory").value;
  const sizes = document.getElementById("productSizes").value.trim();
  const description = document.getElementById("productDescription").value.trim();
  const isPromo = document.getElementById("productPromo").checked;
  const isFeatured = document.getElementById("productFeatured").checked;
  const active = document.getElementById("productActive").checked;
  const imageFile = document.getElementById("productImage").files[0];

  const slug = slugInput || slugify(name);

  try {
    let imageUrl = null;

    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile, slug);
    }

    const { error } = await supabaseClient.from("products").insert([
      {
        name,
        slug,
        price,
        image_url: imageUrl,
        category_id: categoryId || null,
        sizes,
        description,
        is_promo: isPromo,
        is_featured: isFeatured,
        active,
      },
    ]);

    if (error) {
      showToast(error.message || "Erro ao salvar produto.", "error");
      return;
    }

    productForm.reset();
    document.getElementById("productActive").checked = true;

    showToast("Produto cadastrado com sucesso.");
    await loadProducts();
  } catch (err) {
    showToast(err.message || "Erro ao enviar imagem.", "error");
  }
});

async function checkSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setLoggedInUI(false);
    return;
  }

  if (data.session) {
    setLoggedInUI(true);
    await refreshDashboard();
  } else {
    setLoggedInUI(false);
  }
}

document.getElementById("categoryName").addEventListener("input", (e) => {
  const slugField = document.getElementById("categorySlug");
  if (!slugField.dataset.edited) {
    slugField.value = slugify(e.target.value);
  }
});

document.getElementById("categorySlug").addEventListener("input", (e) => {
  e.target.dataset.edited = "true";
});

document.getElementById("productName").addEventListener("input", (e) => {
  const slugField = document.getElementById("productSlug");
  if (!slugField.dataset.edited) {
    slugField.value = slugify(e.target.value);
  }
});

document.getElementById("productSlug").addEventListener("input", (e) => {
  e.target.dataset.edited = "true";
});

supabaseClient.auth.onAuthStateChange(async (_event, session) => {
  if (session) {
    setLoggedInUI(true);
    await refreshDashboard();
  } else {
    setLoggedInUI(false);
  }
});

checkSession();