let chartManual = null;
let chartCSV = null;
let csvData = []; // <-- simpan semua data dari API
let currentPage = 1;
const rowsPerPage = 10;

/* ======================================================
   SAFE ELEMENT GETTER
   Mengecek elemen sebelum dipakai agar tidak error
====================================================== */
function $(id) {
  return document.getElementById(id);
}

/* ======================================================
   MULTI TEXT PREDICT (Hanya aktif di analisis_text.html)
====================================================== */
function predictManual() {
  if (!$("reviewInput")) return; // halaman ini bukan analisis_text → stop

  const rawInput = $("reviewInput").value.trim();
  if (!rawInput) return alert("Masukkan minimal 1 review!");

  const texts = rawInput
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
  if (texts.length === 0) return alert("Format input tidak valid.");

  // const joined = texts.join("||");
  const joined = texts.join(",");

  $("loadingManual").classList.remove("hidden");
  $("resultBox").classList.add("hidden");



  fetch("https://nodejs-api-sentimen-production.up.railway.app/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: joined }),
  })
    .then((res) => res.json())
    .then((data) => {
      let tableHTML = `
      <h2 class='text-xl font-semibold mb-3'>Hasil Analisis</h2>
      <table class='w-full rounded-2xl shadow-xl text-left border-collapse'>
        <thead  class="bg-amber-100 border-b-2 border-gray-200 text-white">
          <tr class='bg-amber-700'>
            <th class='p-2 border'>Review</th>
            <th class='p-2 border'>Sentimen</th>
            <th class='p-2 border'>Confidence</th>
          </tr>
        </thead>
        <tbody>
      `;

      let summary = { positif: 0, negatif: 0, netral: 0 };

      data.forEach((item) => {
        tableHTML += `
          <tr>
            <td class='border p-2'>${item.text}</td>
            <td class='border p-2'>${item.sentiment}</td>
            <td class='border p-2'>${(item.confidence * 100).toFixed(2)}%</td>
          </tr>`;
        summary[item.sentiment]++;
      });

      tableHTML += `</tbody></table>`;

      $("resultBox").classList.remove("hidden");
      $("resultBox").innerHTML = tableHTML;

      drawChartManual(summary);
    })
    .finally(() => $("loadingManual").classList.add("hidden"));
}

/* ======================================================
   CSV UPLOAD (Hanya aktif di uploadcsv.html)
====================================================== */
function uploadCSV() {
  if (!$("csvInput")) return;

  const file = $("csvInput").files[0];
  if (!file) return alert("Pilih file CSV terlebih dahulu");

  const formData = new FormData();
  formData.append("file", file);

  $("loadingCSV").classList.remove("hidden");
  $("csvResult").classList.add("hidden");

  fetch("https://nodejs-api-sentimen-production.up.railway.app/predict-csv", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((data) => {
      // SIMPAN DATA CSV UNTUK PAGINATION
      csvData = data.results;

      // TAMPILKAN HALAMAN PERTAMA
      currentPage = 1;
      displayTable(currentPage);
      setupPagination();

      $("csvResult").classList.remove("hidden");

      // ============ CHART ===============
      drawChartCSV(data.summary);

      // ============ SUMMARY CARD ============
      $("totalCount").textContent = csvData.length;
      $("positifCount").textContent = data.summary.positif || 0;
      $("negatifCount").textContent = data.summary.negatif || 0;
      $("netralCount").textContent = data.summary.netral || 0;
    })
    .finally(() => $("loadingCSV").classList.add("hidden"));
}



function displayTable(page) {
  const table = $("csvTableBody");
  table.innerHTML = "";

  const start = (page - 1) * rowsPerPage;
  const end = start + rowsPerPage;

  const pageData = csvData.slice(start, end);

  pageData.forEach((row) => {
    table.innerHTML += `
      <tr>
        <td class="p-2 border">${row.text}</td>
        <td class="p-2 border">${row.sentiment}</td>
      </tr>`;
  });
}

function setupPagination() {
  const totalPages = Math.ceil(csvData.length / rowsPerPage);
  const pagination = $("pagination");
  pagination.innerHTML = "";

  // Tombol PREV
  const prevBtn = document.createElement("button");
  prevBtn.innerText = "Prev";
  prevBtn.className =
    "px-3 py-1 border rounded mx-1 hover:bg-gray-300 transition " +
    (currentPage === 1 ? "opacity-50 cursor-not-allowed" : "");
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      displayTable(currentPage);
      setupPagination();
    }
  };
  pagination.appendChild(prevBtn);

  // Range halaman yang ditampilkan (4 halaman saja)
  let startPage = Math.max(1, currentPage - 1);
  let endPage = Math.min(totalPages, startPage + 3);

  // Agar tetap 4 nomor saat mendekati akhir
  if (endPage - startPage < 3) {
    startPage = Math.max(1, endPage - 3);
  }

  // Tampilkan nomor halaman
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.innerText = i;

    btn.className =
      "px-3 py-1 border rounded mx-1 hover:bg-gray-300 transition " +
      (i === currentPage ? "bg-green-500 text-white" : "bg-white");

    btn.addEventListener("click", () => {
      currentPage = i;
      displayTable(currentPage);
      setupPagination();
    });

    pagination.appendChild(btn);
  }

  // Tombol NEXT
  const nextBtn = document.createElement("button");
  nextBtn.innerText = "Next";
  nextBtn.className =
    "px-3 py-1 border rounded mx-1 hover:bg-gray-300 transition " +
    (currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "");
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      displayTable(currentPage);
      setupPagination();
    }
  };
  pagination.appendChild(nextBtn);
}

/* ======================================================
   CHART: MULTI TEXT
====================================================== */
function drawChartManual(summary) {
  if (!$("sentimentChartManual")) return;

  if (chartManual) chartManual.destroy();

  // ============================
  // DATASET
  // ============================
  const data = {
    labels: ["Positif", "Negatif", "Netral"],
    datasets: [
      {
        label: "Jumlah Sentimen",
        data: [summary.positif || 0, summary.negatif || 0, summary.netral || 0],

        // warna lembut & profesional
        backgroundColor: [
          "rgba(74, 222, 128, 0.4)", // green-400
          "rgba(248, 113, 113, 0.4)", // red-400
          "rgba(250, 204, 21, 0.4)", // amber-400
        ],

        borderColor: [
          "rgb(74, 222, 128)", // green-400
          "rgb(248, 113, 113)", // red-400
          "rgb(250, 204, 21)", // amber-400
        ],

        borderWidth: 2,
      },
    ],
  };

  // ============================
  // CHART CONFIG
  // ============================
  const config = {
    type: "bar",
    data: data,
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  };

  // ============================
  // RENDER CHART
  // ============================
  chartManual = new Chart($("sentimentChartManual"), config);
}

/* ======================================================
   CHART: CSV UPLOAD
====================================================== */
function drawChartCSV(summary) {
  if (!$("sentimentChartCSV")) return;

  if (chartCSV) chartCSV.destroy();

  // ============================
  // DATASET
  // ============================
  const data = {
    labels: ["Positif", "Negatif", "Netral"],
    datasets: [
      {
        label: "Jumlah Sentimen",
        data: [summary.positif || 0, summary.negatif || 0, summary.netral || 0],

        // Warna bar (jeli & lembut agar tidak sakit mata)
        backgroundColor: [
          "rgba(74, 222, 128, 0.4)", // green-400
          "rgba(248, 113, 113, 0.4)", // red-400
          "rgba(250, 204, 21, 0.4)", // amber-400
        ],

        // Border warna solid
        borderColor: [
          "rgb(74, 222, 128)", // green-400
          "rgb(248, 113, 113)", // red-400
          "rgb(250, 204, 21)", // amber-400
        ],

        borderWidth: 2,
      },
    ],
  };

  // ============================
  // CONFIG CHART
  // ============================
  const config = {
    type: "bar",
    data: data,
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
          },
        },
      },
    },
  };

  // ============================
  // RENDER CHART
  // ============================
  chartCSV = new Chart($("sentimentChartCSV"), config);
}

