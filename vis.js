(function () {
  const D = CROSSING;
  const FIRST = 2000, LAST = 2100;      // matplotlib vmin / vmax
  const NEVER = "#bbbbbb";              // gray = never reaches the threshold by 2100
  const ALREADY = "#4a1486";            // purple = already past the threshold in 2000

  // ---- grid geometry -------------------------------------------------------
  // Work out the grid from the data itself so lat/lon can never disagree with the grids.
  const nCells = Object.values(D.scenarios[0].grids)[0].length;
  const nLat = Math.round(Math.sqrt(nCells / 2)), nLon = nLat * 2;
  if (nLat * nLon !== nCells) throw new Error("grid size " + nCells + " is not a 2:1 lat/lon grid");
  const STEP = 180 / nLat;                                   // 1 for 180x360, 5 for 36x72
  const lat = d3.range(nLat).map(i => -90 + STEP / 2 + i * STEP);
  const lon = d3.range(nLon).map(i => -180 + STEP / 2 + i * STEP);
  if (D.lat.length !== nLat) console.warn(
    `crossing_data.js lat/lon are ${D.lat.length}x${D.lon.length} but the grids hold ${nCells} cells ` +
    `(${nLat}x${nLon}). Re-run the export cell in the notebook; using the grid size for now.`);

  // YlOrRd_r over 2001-2100: early = dark red, late = pale yellow
  const ramp = d3.scaleSequential(d3.interpolateYlOrRd).domain([LAST, FIRST + 1]).clamp(true);
  const colorOf = v => v == null ? NEVER : v <= FIRST ? ALREADY : ramp(v);

  // ---- layout --------------------------------------------------------------
  const m = { top: 8, right: 16, bottom: 120, left: 56 };
  const mapW = 888, mapH = mapW / 2;
  const W = m.left + mapW + m.right, H = m.top + mapH + m.bottom;
  const x = d3.scaleLinear().domain([-180, 180]).range([0, mapW]);
  const y = d3.scaleLinear().domain([90, -90]).range([0, mapH]);

  const svg = d3.select("#chart").attr("viewBox", `0 0 ${W} ${H}`);
  const g = svg.append("g").attr("transform", `translate(${m.left},${m.top})`);
  svg.append("defs").append("clipPath").attr("id", "clip")
    .append("rect").attr("width", mapW).attr("height", mapH);

  const plot = g.append("g").attr("clip-path", "url(#clip)").attr("class", "zoomable");
  const zoomG = plot.append("g");
  // ONE raster image holding two copies of the world side by side, so panning can loop
  // (two separate <image> elements leave a hairline gap between them at fractional offsets)
  const imgs = zoomG.append("image")
    .attr("x", 0).attr("y", 0).attr("width", 2 * mapW).attr("height", mapH)
    .attr("preserveAspectRatio", "none")
    .style("image-rendering", "pixelated");
  // transparent rect on top to catch the mouse
  const hit = plot.append("rect").attr("width", mapW).attr("height", mapH).attr("fill", "none")
    .attr("pointer-events", "all");

  const off = document.createElement("canvas");
  off.width = 2 * nLon; off.height = nLat;
  const octx = off.getContext("2d");
  function paint(grid) {
    const img = octx.createImageData(nLon, nLat);
    for (let i = 0; i < nCells; i++) {
      // grid row 0 is the southernmost latitude; image row 0 must be the northernmost
      const r = Math.floor(i / nLon), c = i % nLon;
      const o = ((nLat - 1 - r) * nLon + c) * 4;
      const col = d3.rgb(colorOf(grid[i]));
      img.data[o] = col.r; img.data[o + 1] = col.g; img.data[o + 2] = col.b; img.data[o + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    octx.putImageData(img, nLon, 0);          // second copy of the world
    imgs.attr("href", off.toDataURL());
  }

  // ---- axes + frame --------------------------------------------------------
  const gx = g.append("g").attr("class", "axis").attr("transform", `translate(0,${mapH})`);
  const gy = g.append("g").attr("class", "axis");
  const wrapLon = d => { const w = ((d + 180) % 360 + 360) % 360 - 180; return (w === -180 ? 180 : w) + "°"; };
  function drawAxes(xs, ys) {
    gx.call(d3.axisBottom(xs).ticks(8).tickFormat(wrapLon));
    gy.call(d3.axisLeft(ys).ticks(6).tickFormat(d => d + "°"));
  }
  drawAxes(x, y);
  g.append("rect").attr("width", mapW).attr("height", mapH).attr("fill", "none").attr("stroke", "var(--fg)");
  g.append("text").attr("class", "label").attr("x", mapW / 2).attr("y", mapH + 38)
    .attr("text-anchor", "middle").text("Longitude");
  g.append("text").attr("class", "label").attr("transform", `translate(-42,${mapH / 2}) rotate(-90)`)
    .attr("text-anchor", "middle").text("Latitude");

  // ---- horizontal colorbar (2001-2100) with the two special swatches -------
  const lg = g.append("g").attr("transform", `translate(0,${mapH + 56})`);
  const barX = 150, barW = 440, barH = 14;
  const grad = svg.select("defs").append("linearGradient").attr("id", "grad");   // 2001 left -> 2100 right
  d3.range(0, 1.001, 0.05).forEach(t =>
    grad.append("stop").attr("offset", t * 100 + "%").attr("stop-color", ramp(FIRST + 1 + t * (LAST - FIRST - 1))));
  lg.append("rect").attr("x", barX).attr("width", barW).attr("height", barH).attr("fill", "url(#grad)");
  lg.append("g").attr("class", "axis").attr("transform", `translate(${barX},${barH})`)
    .call(d3.axisBottom(d3.scaleLinear().domain([FIRST + 1, LAST]).range([0, barW]))
      .tickValues([2001, 2025, 2050, 2075, 2100]).tickFormat(d3.format("d")));
  const barLabel = lg.append("text").attr("class", "label").attr("x", barX + barW / 2).attr("y", barH + 34)
    .attr("text-anchor", "middle");
  lg.append("rect").attr("width", 14).attr("height", 14).attr("fill", ALREADY);
  lg.append("text").attr("class", "label").attr("x", 20).attr("y", 12).text("Reached in 2000");
  lg.append("rect").attr("x", barX + barW + 20).attr("width", 14).attr("height", 14).attr("fill", NEVER);
  lg.append("text").attr("class", "label").attr("x", barX + barW + 40).attr("y", 12).text("Never reached by 2100");

  // ---- controls ------------------------------------------------------------
  const scn = d3.select("#scn");
  scn.selectAll("option").data(D.scenarios).join("option").attr("value", d => d.id).text(d => d.label);
  scn.property("value", D.scenarios.find(s => s.id === "ssp585") ? "ssp585" : D.scenarios[0].id);
  const thr = d3.select("#thr").attr("max", D.thresholds.length - 1)
    .property("value", Math.max(0, D.thresholds.indexOf(1.5)));

  // share of the globe's area (cos(latitude) weights) that reaches the threshold by 2100
  const wts = d3.range(nCells).map(i => Math.cos(lat[Math.floor(i / nLon)] * Math.PI / 180));
  const wTotal = d3.sum(wts);
  let grid = [];

  // The model's longitudes only reach about +-179.4, so the notebook's 1° grid centers at
  // -179.5 and 179.5 fall just outside and come out as NaN (the gray stripe at the dateline).
  // Copy the neighbouring column into any empty edge cell. Remove this once the notebook
  // export is fixed (extrapolate when regridding).
  function healEdges(src) {
    const out = src.slice();
    for (let r = 0; r < nLat; r++) {
      const a = r * nLon, b = a + nLon - 1;
      if (out[a] == null) out[a] = out[a + 1];
      if (out[b] == null) out[b] = out[b - 1];
    }
    return out;
  }

  function update() {
    const s = D.scenarios.find(d => d.id === scn.property("value"));
    const t = D.thresholds[+thr.property("value")];
    grid = healEdges(s.grids[String(t)]);
    d3.select("#thrOut").text(t);
    barLabel.text(`Year the ${t}°C threshold was reached`);
    const share = 100 * d3.sum(grid, (v, i) => v != null ? wts[i] : 0) / wTotal;
    const by2000 = 100 * d3.sum(grid, (v, i) => v != null && v <= FIRST ? wts[i] : 0) / wTotal;
    d3.select("#title").text(`When does each place reach ${t}°C of warming with ${s.label} emissions?`);
    d3.select("#sub").text(`${by2000.toFixed(0)}% of the globe's area is already there in the year 2000, ` +
      `${share.toFixed(0)}% gets there by the year 2100.`);
    paint(grid);
  }

  // ---- tooltip -------------------------------------------------------------
  const tip = d3.select("#tip");
  let cur = d3.zoomIdentity;
  hit.on("mousemove", ev => {
    const [px, py] = d3.pointer(ev, plot.node());
    const wx = (((px - cur.x) / cur.k) % mapW + mapW) % mapW, wy = (py - cur.y) / cur.k;
    const c = Math.min(nLon - 1, Math.floor(wx / mapW * nLon));
    const r = nLat - 1 - Math.min(nLat - 1, Math.max(0, Math.floor(wy / mapH * nLat)));
    const v = grid[r * nLon + c];
    const txt = v == null ? "never by 2100" : v <= FIRST ? "already there in 2000" : `reached in ${v}`;
    const box = document.getElementById("wrap").getBoundingClientRect();
    const la = lat[r], lo = lon[c];
    tip.style("opacity", 1).style("left", (ev.clientX - box.left) + "px").style("top", (ev.clientY - box.top) + "px")
      .html(`${Math.abs(la)}°${la < 0 ? "S" : "N"}, ${Math.abs(lo)}°${lo < 0 ? "W" : "E"}<br>${txt}`);
  }).on("mouseleave", () => tip.style("opacity", 0));

  // ---- zoom + pan (loops sideways) -----------------------------------------
  const zoom = d3.zoom().scaleExtent([1, 12])
    .extent([[0, 0], [mapW, mapH]])
    .translateExtent([[-Infinity, 0], [Infinity, mapH]])
    .on("zoom", ev => {
      const t = ev.transform, worldW = mapW * t.k;
      cur = d3.zoomIdentity.translate(t.x - worldW * Math.ceil(t.x / worldW), t.y).scale(t.k);
      zoomG.attr("transform", cur);
      drawAxes(cur.rescaleX(x), cur.rescaleY(y));
      tip.style("opacity", 0);
    });
  plot.call(zoom);
  d3.select("#reset").on("click", () => plot.transition().duration(400).call(zoom.transform, d3.zoomIdentity));

  thr.on("input", update);
  scn.on("change", update);
  update();
})();