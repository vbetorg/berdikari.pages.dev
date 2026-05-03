export async function onRequest(context) {
  try {
    const url = new URL(context.request.url);
    const path = url.pathname;

    const API_URL = "https://script.google.com/macros/s/AKfycbxXpn0lB80LpLRaJHKBI5wgLjnyGLU-gXC3qTo-MxXBuJlHbTZ10ORuFdnDRl1LB2y5/exec";
    const DOMAIN = url.origin;

    const match = path.match(/^\/artikel\/(.+)$/);
    const slug = match ? match[1] : null;

    // ======================
    // FETCH DATA
    // ======================
    const res = await fetch(API_URL);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
      if (!Array.isArray(data)) data = [];
    } catch {
      return new Response("Bukan JSON:\n" + text);
    }

    // ======================
    // SITEMAP
    // ======================
    if (path === "/sitemap.xml") {
      const items = data.map(item => {
        let s = item.slug || item.id;
        if (typeof s === "string") {
          s = s.toLowerCase().replace(/\s+/g, "-");
        }
        return `<url><loc>${DOMAIN}/artikel/${s}</loc></url>`;
      }).join("");

      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>${DOMAIN}/</loc></url>
        ${items}
      </urlset>`, {
        headers: { "content-type": "application/xml" },
      });
    }

    // ======================
    // HOMEPAGE
    // ======================
    if (!slug) {

      let cards = "";

      data.forEach(item => {
        let s = item.slug || item.id;
        if (typeof s === "string") {
          s = s.toLowerCase().replace(/\s+/g, "-");
        }

        const title = item.title || "Artikel";
        const desc = (item.meta_description || "").substring(0, 120);

        // IMAGE FIX
        const image = item.image && item.image.trim() !== ""
          ? item.image
          : "/default.png";

        cards += `
          <a href="/artikel/${s}" class="card">
            <img src="${image}" alt="${title}" loading="lazy">
            <h2>${title}</h2>
            <p>${desc}</p>
          </a>
        `;
      });

      return new Response(`
      <html>
      <head>
        <title>Blog Artikel</title>

        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="description" content="Kumpulan artikel terbaru">
        <meta name="robots" content="index, follow">

        <style>
          body {margin:0;font-family:sans-serif;background:#f5f5f5;}
          header {background:#111;color:#fff;padding:20px;text-align:center;}
          .container {max-width:1100px;margin:auto;padding:20px;}
          .grid {
            display:grid;
            grid-template-columns:repeat(auto-fill,minmax(250px,1fr));
            gap:20px;
          }
          .card {
            background:#fff;
            border-radius:10px;
            padding:15px;
            text-decoration:none;
            color:#000;
            box-shadow:0 5px 15px rgba(0,0,0,0.05);
          }
          .card img {
            width:100%;
            height:150px;
            object-fit:cover;
            border-radius:8px;
            margin-bottom:10px;
          }
        </style>
      </head>

      <body>
        <header>
          <h1>Blog Artikel</h1>
        </header>

        <div class="container">
          <div class="grid">
            ${cards}
          </div>
        </div>
      </body>
      </html>
      `, {
        headers: { "content-type": "text/html;charset=UTF-8" },
      });
    }

    // ======================
    // ARTIKEL
    // ======================
    const artikel = data.find(item => {
      let s = item.slug || item.id;
      if (typeof s === "string") {
        s = s.toLowerCase().replace(/\s+/g, "-");
      }
      return s == slug;
    });

    if (!artikel) {
      return new Response("Not found", { status: 404 });
    }

    const title = artikel.title || "Artikel";
    const content = artikel.content || "<p>Tidak ada konten</p>";
    const desc = artikel.meta_description || content.substring(0, 140);

    const fullUrl = `${DOMAIN}/artikel/${slug}`;

    const image = artikel.image && artikel.image.trim() !== ""
      ? artikel.image
      : "/default.png";

    // RELATED
    let related = "<h3>Artikel Terkait</h3><ul>";

    data.slice(0,5).forEach(item => {
      let s = item.slug || item.id;
      if (typeof s === "string") {
        s = s.toLowerCase().replace(/\s+/g, "-");
      }
      related += `<li><a href="/artikel/${s}">${item.title || "Artikel"}</a></li>`;
    });

    related += "</ul>";

    // JSON-LD
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": desc,
      "image": image,
      "mainEntityOfPage": fullUrl,
      "author": {
        "@type": "Person",
        "name": "Admin"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Website Kamu"
      }
    };

    return new Response(`
    <html>
    <head>
      <title>${title}</title>

      <!-- BASIC -->
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="${desc}">
      <meta name="robots" content="index, follow">
      <link rel="canonical" href="${fullUrl}">

      <!-- OG -->
      <meta property="og:title" content="${title}">
      <meta property="og:description" content="${desc}">
      <meta property="og:image" content="${image}">
      <meta property="og:url" content="${fullUrl}">
      <meta property="og:type" content="article">

      <!-- TWITTER -->
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:title" content="${title}">
      <meta name="twitter:description" content="${desc}">
      <meta name="twitter:image" content="${image}">

      <!-- JSON -->
      <script type="application/ld+json">
        ${JSON.stringify(jsonLd)}
      </script>

      <style>
        body {font-family:sans-serif;max-width:800px;margin:auto;padding:20px;}
        img {width:100%;border-radius:10px;margin-bottom:15px;}
      </style>
    </head>

    <body>
      <img src="${image}" alt="${title}" loading="lazy">

      <h1>${title}</h1>
      <p><i>${desc}</i></p>

      ${content}

      ${related}

      <br><a href="/">← Kembali</a>
    </body>
    </html>
    `, {
      headers: { "content-type": "text/html;charset=UTF-8" },
    });

  } catch (err) {
    return new Response("ERROR:\n" + err.toString());
  }
}
