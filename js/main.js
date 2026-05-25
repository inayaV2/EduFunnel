let appData = null;
let monthlyChart = null;

let currentPage = "overview";
let currentChannel = "all";
let currentDateRange = "7";
let currentSearch = "";
let supabaseClient = null;

const SUPABASE_URL = "https://tyjgxjawjqwerwemzkhy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_afBHm3NGmsvCN7GUAKlNPw_-sAd5z26";

const CHANNEL_TRAFFIC_KEYS = {
  "Google Ads": "google_ads",
  Instagram: "instagram",
  "Twitter/X": "twitter_x",
  Website: "website"
};

/* ================= ELEMENTS ================= */
const registerPage = document.getElementById("registerPage");
const loginPage = document.getElementById("loginPage");
const dashboardPage = document.getElementById("dashboardPage");
const app = document.getElementById("app");

const registerForm = document.getElementById("registerForm");
const loginForm = document.getElementById("loginForm");

const goToLogin = document.getElementById("goToLogin");
const goToRegister = document.getElementById("goToRegister");
const logoutButton = document.getElementById("logoutButton");

const searchInput = document.getElementById("searchInput");
const channelFilter = document.getElementById("channelFilter");
const dateFilter = document.getElementById("dateFilter");

/* ================= PAGE SWITCHING ================= */
function showRegisterPage() {
  registerPage.classList.remove("hidden");
  loginPage.classList.add("hidden");
  dashboardPage.classList.add("hidden");
}

function showLoginPage() {
  registerPage.classList.add("hidden");
  loginPage.classList.remove("hidden");
  dashboardPage.classList.add("hidden");
}

function showDashboardPage() {
  registerPage.classList.add("hidden");
  loginPage.classList.add("hidden");
  dashboardPage.classList.remove("hidden");

  fetchEduFunnelData();
}

function createSupabaseClient() {
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase client belum dimuat.");
  }

  if (!supabaseClient) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  return supabaseClient;
}

function setButtonLoading(button, isLoading, loadingText) {
  if (!button) return;

  if (isLoading) {
    button.dataset.defaultText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }

  button.textContent = button.dataset.defaultText || button.textContent;
  button.disabled = false;
}

async function getCurrentSupabaseUser() {
  const client = createSupabaseClient();
  const { data, error } = await client.auth.getUser();

  if (error) return null;

  return data.user || null;
}

/* ================= AUTH ================= */
goToLogin.addEventListener("click", showLoginPage);
goToRegister.addEventListener("click", showRegisterPage);

registerForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  const submitButton = registerForm.querySelector("button[type='submit']");

  if (password !== confirmPassword) {
    alert("Password dan Confirm Password tidak sama.");
    return;
  }

  try {
    setButtonLoading(submitButton, true, "Creating...");

    const client = createSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: name
        }
      }
    });

    if (error) throw error;

    registerForm.reset();

    if (data.session) {
      showDashboardPage();
      return;
    }

    alert("Akun berhasil dibuat. Jika Supabase meminta verifikasi email, cek inbox sebelum login.");
    showLoginPage();
  } catch (error) {
    console.error("Gagal membuat akun Supabase:", error);
    alert(error.message || "Akun gagal dibuat.");
  } finally {
    setButtonLoading(submitButton, false);
  }
});

loginForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const submitButton = loginForm.querySelector("button[type='submit']");

  try {
    setButtonLoading(submitButton, true, "Signing in...");

    const client = createSupabaseClient();
    const { error } = await client.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) throw error;

    loginForm.reset();
    showDashboardPage();
  } catch (error) {
    console.error("Gagal login Supabase:", error);
    alert("Email atau password salah, atau akun belum diverifikasi.");
  } finally {
    setButtonLoading(submitButton, false);
  }
});

logoutButton.addEventListener("click", async function () {
  try {
    const client = createSupabaseClient();
    await client.auth.signOut();
  } catch (error) {
    console.error("Gagal logout Supabase:", error);
  }

  showLoginPage();
});

/* ================= FETCH DATA ================= */
function getLocalEduFunnelData() {
  if (!window.eduFunnelData) return null;

  return JSON.parse(JSON.stringify(window.eduFunnelData));
}

function validateEduFunnelData(data) {
  return data && Array.isArray(data.sources);
}

function mapSupabaseData(summaryRow, sourcesRows, trafficRows, dailyRows) {
  if (!summaryRow || !Array.isArray(sourcesRows) || !Array.isArray(trafficRows) || !Array.isArray(dailyRows)) {
    throw new Error("Format data Supabase tidak lengkap.");
  }

  const summary = {
    total_pengunjung: Number(summaryRow.total_pengunjung),
    total_daftar: Number(summaryRow.total_daftar),
    total_test: Number(summaryRow.total_test),
    total_daftar_ulang: Number(summaryRow.total_daftar_ulang),
    total_berkuliah: Number(summaryRow.total_berkuliah)
  };

  const conversionRate = summary.total_pengunjung === 0
    ? 0
    : Number(((summary.total_berkuliah / summary.total_pengunjung) * 100).toFixed(1));

  return {
    metadata: {
      project_name: summaryRow.project_name,
      period: summaryRow.period,
      generated_by: summaryRow.generated_by
    },
    summary: summary,
    metric_cards: [
      {
        title: "Total Pengunjung",
        value: summary.total_pengunjung
      },
      {
        title: "Total Berkuliah",
        value: summary.total_berkuliah
      },
      {
        title: "Conversion Rate",
        value: conversionRate
      }
    ],
    funnel_stages: summaryRow.funnel_stages || [
      "Pengunjung",
      "Daftar",
      "Test",
      "Daftar Ulang",
      "Berkuliah"
    ],
    funnel_data: summaryRow.funnel_data || [
      summary.total_pengunjung,
      summary.total_daftar,
      summary.total_test,
      summary.total_daftar_ulang,
      summary.total_berkuliah
    ],
    sources: sourcesRows.map(function (source) {
      return {
        name: source.name,
        pengunjung: Number(source.pengunjung),
        daftar: Number(source.daftar),
        test: Number(source.test),
        daftar_ulang: Number(source.daftar_ulang),
        berkuliah: Number(source.berkuliah),
        conversion_rate: Number(source.conversion_rate),
        drop_off: Number(source.drop_off),
        progression_rates: source.progression_rates || {},
        attrition_rates: source.attrition_rates || {},
        ranking: Number(source.ranking),
        status: source.status
      };
    }),
    monthly_channel_traffic: trafficRows.map(function (item) {
      return {
        month: item.month,
        google_ads: Number(item.google_ads),
        instagram: Number(item.instagram),
        twitter_x: Number(item.twitter_x),
        website: Number(item.website)
      };
    }),
    daily_channel_traffic: dailyRows.map(function (item) {
      return {
        date: item.date,
        channel: item.channel,
        pengunjung: Number(item.pengunjung),
        daftar: Number(item.daftar),
        test: Number(item.test),
        daftar_ulang: Number(item.daftar_ulang),
        berkuliah: Number(item.berkuliah)
      };
    })
  };
}

async function fetchSupabaseData() {
  const client = createSupabaseClient();

  const [summaryResult, sourcesResult, trafficResult, dailyResult] = await Promise.all([
    client
      .from("summary_metrics")
      .select("*")
      .eq("period", "2025")
      .maybeSingle(),
    client
      .from("funnel_sources")
      .select("*")
      .eq("period", "2025")
      .order("id", { ascending: true }),
    client
      .from("monthly_channel_traffic")
      .select("*")
      .eq("period", "2025")
      .order("month_order", { ascending: true }),
    client
      .from("daily_channel_traffic")
      .select("*")
      .order("date", { ascending: true })
      .order("channel", { ascending: true })
  ]);

  if (summaryResult.error) throw summaryResult.error;
  if (sourcesResult.error) throw sourcesResult.error;
  if (trafficResult.error) throw trafficResult.error;
  if (dailyResult.error) throw dailyResult.error;

  return mapSupabaseData(summaryResult.data, sourcesResult.data, trafficResult.data, dailyResult.data);
}

async function fetchJsonFallbackData() {
  if (window.location.protocol !== "file:") {
    const response = await fetch("data_funnel.json");

    if (response.ok) {
      return response.json();
    }
  }

  const localData = getLocalEduFunnelData();

  if (validateEduFunnelData(localData)) {
    return localData;
  }

  throw new Error("Fallback data_funnel tidak tersedia.");
}

async function fetchEduFunnelData() {
  try {
    app.innerHTML = `
      <section class="loading-state">
        <h2>Loading data...</h2>
        <p>Sedang mengambil data dashboard dari Supabase.</p>
      </section>
    `;

    appData = await fetchSupabaseData();

    setupNavigation();
    setupSearch();
    setupFilters();

    renderPage("overview");
  } catch (error) {
    console.error("Gagal mengambil data dari Supabase:", error);

    try {
      app.innerHTML = `
        <section class="loading-state">
          <h2>Loading data...</h2>
          <p>Supabase belum tersedia. Menggunakan fallback data_funnel.json.</p>
        </section>
      `;

      const fallbackData = await fetchJsonFallbackData();

      if (!validateEduFunnelData(fallbackData)) {
        throw new Error("Format fallback data_funnel tidak valid.");
      }

      appData = fallbackData;
      setupNavigation();
      setupSearch();
      setupFilters();
      renderPage("overview");
      return;
    } catch (fallbackError) {
      console.error("Gagal mengambil fallback data:", fallbackError);
    }

    app.innerHTML = `
      <section class="empty-state">
        <h2>Data gagal dimuat</h2>
        <p>Query Supabase gagal dan fallback data_funnel tidak tersedia.</p>
      </section>
    `;
  }
}

/* ================= NAVIGATION ================= */
function setupNavigation() {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach(function (item) {
    item.onclick = function () {
      setActiveMenu(item.dataset.page);
      renderPage(item.dataset.page);
    };
  });
}

function setActiveMenu(page) {
  const menuItems = document.querySelectorAll(".menu-item");

  menuItems.forEach(function (item) {
    item.classList.remove("active");

    if (item.dataset.page === page) {
      item.classList.add("active");
    }
  });
}

/* ================= SEARCH & FILTER ================= */
function setupSearch() {
  if (!searchInput) return;

  searchInput.oninput = function () {
    currentSearch = searchInput.value.toLowerCase().trim();
    renderPage(currentPage);
  };
}

function setupFilters() {
  if (channelFilter) {
    channelFilter.onchange = function () {
      currentChannel = channelFilter.value;
      renderPage(currentPage);
    };
  }

  if (dateFilter) {
    dateFilter.onchange = function () {
      currentDateRange = dateFilter.value;
      renderPage(currentPage);
    };
  }
}

/* ================= DATE RANGE DATA ================= */
function getMonthlyChannelTraffic() {
  return appData.monthly_channel_traffic || [
    { month: "Jan", google_ads: 19, instagram: 18, twitter_x: 23, website: 18 },
    { month: "Feb", google_ads: 25, instagram: 22, twitter_x: 23, website: 20 },
    { month: "Mar", google_ads: 14, instagram: 16, twitter_x: 14, website: 16 },
    { month: "Apr", google_ads: 18, instagram: 23, twitter_x: 21, website: 29 },
    { month: "May", google_ads: 29, instagram: 23, twitter_x: 24, website: 20 },
    { month: "Jun", google_ads: 29, instagram: 13, twitter_x: 15, website: 27 },
    { month: "Jul", google_ads: 12, instagram: 25, twitter_x: 17, website: 21 },
    { month: "Aug", google_ads: 24, instagram: 26, twitter_x: 23, website: 31 },
    { month: "Sep", google_ads: 19, instagram: 27, twitter_x: 15, website: 21 },
    { month: "Oct", google_ads: 24, instagram: 26, twitter_x: 15, website: 14 },
    { month: "Nov", google_ads: 15, instagram: 21, twitter_x: 21, website: 15 },
    { month: "Dec", google_ads: 28, instagram: 26, twitter_x: 16, website: 19 }
  ];
}

function getDailyChannelTraffic() {
  return appData.daily_channel_traffic || [];
}

function getDailyChannelSummary() {
  return getDailyChannelTraffic().reduce(function (totals, item) {
    if (!totals[item.channel]) {
      totals[item.channel] = {
        pengunjung: 0,
        daftar: 0,
        test: 0,
        daftar_ulang: 0,
        berkuliah: 0
      };
    }

    totals[item.channel].pengunjung += Number(item.pengunjung || 0);
    totals[item.channel].daftar += Number(item.daftar || 0);
    totals[item.channel].test += Number(item.test || 0);
    totals[item.channel].daftar_ulang += Number(item.daftar_ulang || 0);
    totals[item.channel].berkuliah += Number(item.berkuliah || 0);

    return totals;
  }, {});
}

function getChartDataByDateRange() {
  const monthlyData = getMonthlyChannelTraffic();
  const latestMonth = monthlyData[monthlyData.length - 1];

  if (currentDateRange === "7") {
    const dailySummary = getDailyChannelSummary();

    return [
      {
        month: "Last 7 Days",
        google_ads: Number(dailySummary["Google Ads"]?.pengunjung || 0),
        instagram: Number(dailySummary.Instagram?.pengunjung || 0),
        twitter_x: Number(dailySummary["Twitter/X"]?.pengunjung || 0),
        website: Number(dailySummary.Website?.pengunjung || 0)
      }
    ];
  }

  if (currentDateRange === "month") {
    return latestMonth ? [latestMonth] : [];
  }

  if (currentDateRange === "year") {
    return monthlyData;
  }

  return [];
}

function getVisitorsByChannel() {
  const chartData = getChartDataByDateRange();

  return Object.entries(CHANNEL_TRAFFIC_KEYS).reduce(function (totals, [channelName, trafficKey]) {
    totals[channelName] = chartData.reduce(function (total, item) {
      return total + Number(item[trafficKey] || 0);
    }, 0);

    return totals;
  }, {});
}

function buildSourceForVisitors(source, visitors) {
  const baseVisitors = Number(source.pengunjung);
  const ratio = baseVisitors === 0 ? 0 : visitors / baseVisitors;
  const enrolled = Math.round(Number(source.berkuliah) * ratio);
  const conversionRate = visitors === 0 ? 0 : (enrolled / visitors) * 100;

  return {
    ...source,
    pengunjung: visitors,
    daftar: Math.round(Number(source.daftar) * ratio),
    test: Math.round(Number(source.test) * ratio),
    daftar_ulang: Math.round(Number(source.daftar_ulang) * ratio),
    berkuliah: enrolled,
    conversion_rate: conversionRate.toFixed(2)
  };
}

function buildSourceFromDailyData(source, dailySummary) {
  const counts = dailySummary[source.name] || {
    pengunjung: 0,
    daftar: 0,
    test: 0,
    daftar_ulang: 0,
    berkuliah: 0
  };
  const visitors = Number(counts.pengunjung);
  const enrolled = Number(counts.berkuliah);
  const conversionRate = visitors === 0 ? 0 : (enrolled / visitors) * 100;

  return {
    ...source,
    pengunjung: visitors,
    daftar: Number(counts.daftar),
    test: Number(counts.test),
    daftar_ulang: Number(counts.daftar_ulang),
    berkuliah: enrolled,
    conversion_rate: conversionRate.toFixed(2),
    drop_off: Number((100 - conversionRate).toFixed(2))
  };
}

function getDateRangeSources() {
  if (currentDateRange === "7") {
    const dailySummary = getDailyChannelSummary();

    return appData.sources.map(function (source) {
      return buildSourceFromDailyData(source, dailySummary);
    });
  }

  if (currentDateRange === "year") {
    return appData.sources;
  }

  const visitorsByChannel = getVisitorsByChannel();

  return appData.sources.map(function (source) {
    const visitors = Number(visitorsByChannel[source.name] || 0);
    return buildSourceForVisitors(source, visitors);
  });
}

/* ================= FILTERED DATA ================= */
function getFilteredSources() {
  let sources = getDateRangeSources();

  if (currentChannel !== "all") {
    sources = sources.filter(function (source) {
      return source.name === currentChannel;
    });
  }

  if (currentSearch !== "") {
    sources = sources.filter(function (source) {
      return source.name.toLowerCase().includes(currentSearch);
    });
  }

  return sources;
}

function getFilteredSummary() {
  const sources = getFilteredSources();

  if (sources.length === 0) {
    return {
      total_pengunjung: 0,
      total_daftar: 0,
      total_test: 0,
      total_daftar_ulang: 0,
      total_berkuliah: 0
    };
  }

  return {
    total_pengunjung: sources.reduce((total, item) => total + Number(item.pengunjung), 0),
    total_daftar: sources.reduce((total, item) => total + Number(item.daftar), 0),
    total_test: sources.reduce((total, item) => total + Number(item.test), 0),
    total_daftar_ulang: sources.reduce((total, item) => total + Number(item.daftar_ulang), 0),
    total_berkuliah: sources.reduce((total, item) => total + Number(item.berkuliah), 0)
  };
}

function getDateRangeLabel() {
  if (currentDateRange === "month") return "This Month";
  if (currentDateRange === "year") return "This Year";
  return "Last 7 Days";
}

function getChannelTrafficTitle() {
  if (currentDateRange === "month") return "This Month Channel Traffic";
  if (currentDateRange === "year") return "Monthly Channel Traffic";
  return "Last 7 Days Channel Traffic";
}

function renderEmptyState() {
  app.innerHTML = `
    <section class="empty-state">
      <h2>Data tidak ditemukan</h2>
      <p>Coba ubah filter channel, rentang tanggal, atau keyword pencarian.</p>
    </section>
  `;
}

/* ================= PAGE RENDER ================= */
function renderPage(page) {
  currentPage = page;

  if (monthlyChart) {
    monthlyChart.destroy();
    monthlyChart = null;
  }

  if (page === "overview") renderOverview();
  if (page === "channel") renderChannelAnalysis();
  if (page === "funnel") renderFunnelDepth();
  if (page === "table") renderDataTable();
}

/* ================= HELPERS ================= */
function getTotalConversionRate() {
  const summary = getFilteredSummary();

  if (summary.total_pengunjung === 0) {
    return "0.0";
  }

  return ((summary.total_berkuliah / summary.total_pengunjung) * 100).toFixed(1);
}

function getSummaryStages() {
  const summary = getFilteredSummary();

  return [
    { label: "Pengunjung", count: Number(summary.total_pengunjung) },
    { label: "Daftar", count: Number(summary.total_daftar) },
    { label: "Test", count: Number(summary.total_test) },
    { label: "Daftar Ulang", count: Number(summary.total_daftar_ulang) },
    { label: "Berkuliah", count: Number(summary.total_berkuliah) }
  ];
}

function getHighestDrop(stages) {
  let highestDrop = {
    label: "-",
    value: 0,
    percent: 0
  };

  for (let i = 1; i < stages.length; i++) {
    const previous = stages[i - 1];
    const current = stages[i];

    if (previous.count === 0) continue;

    const dropValue = previous.count - current.count;
    const dropPercent = (dropValue / previous.count) * 100;

    if (dropValue > highestDrop.value) {
      highestDrop = {
        label: `${previous.label} ke ${current.label}`,
        value: dropValue,
        percent: dropPercent
      };
    }
  }

  return highestDrop;
}

/* ================= OVERVIEW ================= */
function renderOverview() {
  const filteredSources = getFilteredSources();

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const summary = getFilteredSummary();
  const stages = getSummaryStages();
  const highestDrop = getHighestDrop(stages);

  const bestSource = [...filteredSources].sort(function (a, b) {
    return Number(b.conversion_rate) - Number(a.conversion_rate);
  })[0];

  app.innerHTML = `
    <section class="page-title">
      <p>STUDENT ACQUISITION OVERVIEW</p>
      <h1>Student Acquisition Overview</h1>
      <span>Monitor ${getDateRangeLabel().toLowerCase()} conversion dynamics and pinpoint friction in the enrollment pipeline.</span>
    </section>

    <section class="summary">
      <div class="summary-card">
        <h3>Total Visitors</h3>
        <p>${summary.total_pengunjung.toLocaleString("id-ID")}</p>
      </div>

      <div class="summary-card">
        <h3>Qualified Leads</h3>
        <p>${summary.total_daftar.toLocaleString("id-ID")}</p>
      </div>

      <div class="summary-card">
        <h3>Conversion Rate</h3>
        <p>${getTotalConversionRate()}%</p>
      </div>
    </section>

    <section class="dashboard-grid">
      <div class="card">
        <div class="section-header">
          <div>
            <h2>Acquisition Funnel</h2>
            <span>Visitor-to-Enrollment Flow</span>
          </div>
        </div>

        <div id="overviewFunnel"></div>
      </div>

      <aside class="card insight-card">
        <h2>Key Insight</h2>

        <div class="insight-value">${highestDrop.percent.toFixed(1)}%</div>

        <p>
          Significant drop-off detected between
          <strong>${highestDrop.label}</strong>.
          Total users lost: ${highestDrop.value.toLocaleString("id-ID")}.
        </p>

        <hr />

        <p>
          Best channel:
          <strong>${bestSource.name}</strong>
          with conversion rate ${bestSource.conversion_rate}%.
        </p>

        <button class="auth-button report-btn" onclick="downloadReport()">
          Generate Detailed Report
        </button>
      </aside>
    </section>
  `;

  renderFunnelBars("overviewFunnel", stages);
}

/* ================= CHANNEL ANALYSIS ================= */
function renderChannelAnalysis() {
  const filteredSources = getFilteredSources();

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const channelCards = filteredSources.map(function (source) {
    const badgeClass = source.status === "Alert" ? "risk" : "stable";

    return `
      <div class="channel-card">
        <div class="channel-top">
          <h2>${source.name}</h2>
          <span class="badge ${badgeClass}">${source.status}</span>
        </div>

        <p class="label">Visitors</p>
        <h3>${Number(source.pengunjung).toLocaleString("id-ID")}</h3>

        <div class="channel-stats">
          <div>
            <span>Converted</span>
            <strong>${source.berkuliah}</strong>
          </div>

          <div>
            <span>Conv. Rate</span>
            <strong>${source.conversion_rate}%</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");

  app.innerHTML = `
    <section class="page-title">
      <p>ACQUISITION SOURCES</p>
      <h1>Channel Performance</h1>
      <span>${getDateRangeLabel()} engagement and conversion tracking across acquisition sources.</span>
    </section>

    <section class="channel-grid">
      ${channelCards}
    </section>

    <section class="card">
      <h2>${getChannelTrafficTitle()}</h2>
      <p class="label">${getDateRangeLabel()} visitor volume across all acquisition channels.</p>
      <canvas id="monthlyChart"></canvas>
    </section>
  `;

  renderMonthlyChart();
}

/* ================= FUNNEL DEPTH ================= */
function renderFunnelDepth() {
  const filteredSources = getFilteredSources();

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const stages = getSummaryStages();
  const highestDrop = getHighestDrop(stages);

  app.innerHTML = `
    <section class="page-title">
      <p>ACQUISITION INTELLIGENCE</p>
      <h1>Funnel Depth Analysis</h1>
      <span>Tracking ${getDateRangeLabel().toLowerCase()} prospective student progression from initial website visit to confirmed enrollment.</span>
    </section>

    <section class="dashboard-grid">
      <div class="card">
        <h2>Conversion Stages</h2>
        <div id="depthFunnel"></div>
      </div>

      <aside>
        <div class="card friction-card">
          <h2>Registration Friction</h2>
          <p>
            The <strong>${highestDrop.percent.toFixed(1)}% drop</strong>
            between ${highestDrop.label} indicates friction in the onboarding process.
          </p>
        </div>

        <div class="card">
          <h3>Final Yield</h3>
          <div class="final-yield">${getTotalConversionRate()}%</div>
          <p>Overall conversion from visitor to enrolled student.</p>
        </div>
      </aside>
    </section>
  `;

  renderFunnelBars("depthFunnel", stages);
}

/* ================= DATA TABLE ================= */
function renderDataTable() {
  const filteredSources = getFilteredSources();

  if (filteredSources.length === 0) {
    renderEmptyState();
    return;
  }

  const summary = getFilteredSummary();

  const rows = filteredSources.map(function (source) {
    return `
      <tr>
        <td>${source.name}</td>
        <td>${Number(source.pengunjung).toLocaleString("id-ID")}</td>
        <td>${Number(source.daftar).toLocaleString("id-ID")}</td>
        <td>${Number(source.test).toLocaleString("id-ID")}</td>
        <td>${Number(source.daftar_ulang).toLocaleString("id-ID")}</td>
        <td>${Number(source.berkuliah).toLocaleString("id-ID")}</td>
        <td>${source.conversion_rate}%</td>
        <td>${source.status}</td>
      </tr>
    `;
  }).join("");

  app.innerHTML = `
    <section class="page-title">
      <p>ANALYTICS DATA</p>
      <h1>Acquisition Grid</h1>
      <span>Analyze ${getDateRangeLabel().toLowerCase()} student performance data across primary digital channels.</span>
    </section>

    <section class="summary">
      <div class="summary-card">
        <h3>Total Visitors</h3>
        <p>${summary.total_pengunjung.toLocaleString("id-ID")}</p>
      </div>

      <div class="summary-card">
        <h3>Average CVR</h3>
        <p>${getTotalConversionRate()}%</p>
      </div>

      <div class="summary-card">
        <h3>Active Channels</h3>
        <p>${filteredSources.length}</p>
      </div>
    </section>

    <section class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>Channel Source</th>
            <th>Pengunjung</th>
            <th>Daftar</th>
            <th>Test</th>
            <th>Daftar Ulang</th>
            <th>Berkuliah</th>
            <th>CVR</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          ${rows}

          <tr class="total-row">
            <td>TOTAL</td>
            <td>${summary.total_pengunjung.toLocaleString("id-ID")}</td>
            <td>${summary.total_daftar.toLocaleString("id-ID")}</td>
            <td>${summary.total_test.toLocaleString("id-ID")}</td>
            <td>${summary.total_daftar_ulang.toLocaleString("id-ID")}</td>
            <td>${summary.total_berkuliah.toLocaleString("id-ID")}</td>
            <td>${getTotalConversionRate()}%</td>
            <td>Overall</td>
          </tr>
        </tbody>
      </table>
    </section>
  `;
}

/* ================= FUNNEL BAR ================= */
function renderFunnelBars(containerId, stages) {
  const container = document.getElementById(containerId);
  const firstCount = stages[0].count;

  container.innerHTML = stages.map(function (stage, index) {
    const width = firstCount === 0 ? 0 : (stage.count / firstCount) * 100;

    let dropText = "";

    if (index > 0) {
      const previous = stages[index - 1];

      if (previous.count > 0) {
        const drop = previous.count - stage.count;
        const dropPercent = (drop / previous.count) * 100;

        dropText = `
          <div class="drop">
            ${dropPercent.toFixed(1)}% drop-off
          </div>
        `;
      }
    }

    return `
      <div class="funnel-stage">
        <div class="stage-label">
          <strong>${stage.label}</strong>
          <span>${stage.count.toLocaleString("id-ID")}</span>
        </div>

        <div class="bar-bg">
          <div class="bar-fill" style="width: ${width}%"></div>
        </div>

        ${dropText}
      </div>
    `;
  }).join("");
}

/* ================= CHART ================= */
function renderMonthlyChart() {
  if (typeof Chart === "undefined") {
    const chart = document.getElementById("monthlyChart");

    if (chart) {
      const chartMessage = document.createElement("div");
      chartMessage.className = "empty-state";
      chartMessage.innerHTML = `
        <h2>Grafik belum tersedia</h2>
        <p>Chart.js gagal dimuat. Data channel tetap bisa dibaca.</p>
      `;

      chart.replaceWith(chartMessage);
    }

    return;
  }

  const monthlyData = getChartDataByDateRange();

  const labels = monthlyData.map(item => item.month);
  const googleAds = monthlyData.map(item => item.google_ads);
  const instagram = monthlyData.map(item => item.instagram);
  const twitterX = monthlyData.map(item => item.twitter_x);
  const website = monthlyData.map(item => item.website);

  const ctx = document.getElementById("monthlyChart").getContext("2d");

  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Google Ads",
          data: googleAds,
          backgroundColor: "rgba(79, 140, 255, 0.7)"
        },
        {
          label: "Instagram",
          data: instagram,
          backgroundColor: "rgba(0, 212, 255, 0.7)"
        },
        {
          label: "Twitter/X",
          data: twitterX,
          backgroundColor: "rgba(255, 99, 132, 0.7)"
        },
        {
          label: "Website",
          data: website,
          backgroundColor: "rgba(34, 197, 94, 0.7)"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: {
            color: "#cbd5e1"
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      }
    }
  });
}

/* ================= DOWNLOAD REPORT ================= */
function downloadReport() {
  if (!appData) {
    alert("Data belum siap.");
    return;
  }

  const reportData = {
    title: "EduFunnel Detailed Report",
    generated_at: new Date().toLocaleString("id-ID"),
    selected_channel: currentChannel,
    date_range: currentDateRange,
    search_keyword: currentSearch,
    summary: getFilteredSummary(),
    sources: getFilteredSources(),
    monthly_channel_traffic: getChartDataByDateRange()
  };

  const jsonData = JSON.stringify(reportData, null, 2);
  const blob = new Blob([jsonData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "edufunnel-report.json";
  link.click();

  URL.revokeObjectURL(url);
}

/* ================= INIT ================= */
window.addEventListener("load", async function () {
  try {
    const user = await getCurrentSupabaseUser();

    if (user) {
      showDashboardPage();
      return;
    }
  } catch (error) {
    console.error("Gagal mengecek session Supabase:", error);
  }

  showRegisterPage();
});
