// Preserved from NEMADEO v1.1 theme/plasma renderer.
        const THEME_KEY = 'neon_writer_theme';
        function storageGet(key) { try { return localStorage.getItem(key); } catch (_) { return null; } }
        function storageSet(key, value) { try { localStorage.setItem(key, value); return true; } catch (_) { return false; } }

        // --- Color themes: the original five plus seven new palettes ---

        // A theme supplies both three plasma colors and accessible UI colors.
        // Theme changes interpolate rather than snapping to new RGB values.
        const THEME_SKINS = {
            cyber: { bg: "#050608", rail: "#000000", bar: "#06080a", paper: "#080f12", ink: "#ffffff", brand: "#d6e2e8", chrome: "#c9d6dd", border: "#58646b", accent: "#78ffff", hint: "#9adfff", raw: "#b7f7ff" },
            aqua: { bg: "#030b12", rail: "#010408", bar: "#051621", paper: "#06131d", ink: "#f7ffff", brand: "#d1f9ff", chrome: "#bbe6ec", border: "#406674", accent: "#36eeff", hint: "#7adfff", raw: "#c0f6ff" },
            mint: { bg: "#040e0c", rail: "#010706", bar: "#071814", paper: "#091b17", ink: "#f3fff8", brand: "#d2ffe1", chrome: "#b3e3ce", border: "#436c60", accent: "#56f5ab", hint: "#82dfbc", raw: "#b9ffe0" },
            lava: { bg: "#100604", rail: "#060100", bar: "#1b0b08", paper: "#190b0a", ink: "#fff4ec", brand: "#ffe0cb", chrome: "#f2c8b4", border: "#8a5245", accent: "#ff9c56", hint: "#ffd08d", raw: "#ffe2b8" },
            prism: { bg: "#0c0710", rail: "#050207", bar: "#170d1c", paper: "#150e1c", ink: "#fff5ff", brand: "#fae1ff", chrome: "#d8c3e5", border: "#69557b", accent: "#ee80f5", hint: "#e5a6fa", raw: "#f4dbff" },
            wave: { bg: "#10051f", rail: "#05000e", bar: "#200e33", paper: "#1c0c2f", ink: "#fff4ff", brand: "#fbd4ff", chrome: "#d9c5f3", border: "#76528d", accent: "#ff75de", hint: "#f4a3fa", raw: "#f5daff" },
            ocean: { bg: "#020c19", rail: "#00040a", bar: "#071728", paper: "#091c2c", ink: "#eefcff", brand: "#cff7ff", chrome: "#b4d6ed", border: "#3d6580", accent: "#3fe3e8", hint: "#7bdbf4", raw: "#cef6ff" },
            copper: { bg: "#130c07", rail: "#050301", bar: "#221508", paper: "#1e160f", ink: "#fff9eb", brand: "#ffe5bb", chrome: "#e8ccaa", border: "#846345", accent: "#ffc36b", hint: "#f1d18f", raw: "#ffecce" },
            emerald: { bg: "#03100b", rail: "#000604", bar: "#082017", paper: "#0a1b14", ink: "#f1fff5", brand: "#ceffe2", chrome: "#b0e6cc", border: "#356d54", accent: "#53f5a1", hint: "#8ce9b6", raw: "#bfffda" },
            amethyst: { bg: "#0d081b", rail: "#04020b", bar: "#1b1030", paper: "#160e27", ink: "#faf2ff", brand: "#e7d6ff", chrome: "#d6c5ef", border: "#655481", accent: "#bd97ff", hint: "#d7bcff", raw: "#eadcff" },
            ice: { bg: "#07131c", rail: "#02070d", bar: "#0c2636", paper: "#102431", ink: "#f5fdff", brand: "#e0faff", chrome: "#c1e5f0", border: "#56798c", accent: "#adf9ff", hint: "#a9ebff", raw: "#e1faff" },
            crimson: { bg: "#16090e", rail: "#070205", bar: "#270f17", paper: "#210e15", ink: "#fff5f5", brand: "#ffe1e7", chrome: "#ecc8cb", border: "#87525d", accent: "#ff8698", hint: "#ffb0a1", raw: "#ffe3df" }
        };

        const NEON_PALETTES = [
            { name: "Cyan / Lime / Magenta", colors: ["#00ffff", "#7cff00", "#ff4dff"], skin: "cyber" },
            { name: "Aqua / Yellow / Pink", colors: ["#00e5ff", "#ffd000", "#ff5cff"], skin: "aqua" },
            { name: "Mint / Green / Violet", colors: ["#4dffff", "#4dff88", "#b84dff"], skin: "mint" },
            { name: "Lava", colors: ["#ff6a00", "#ff0040", "#ffd000"], skin: "lava" },
            { name: "Prismatic", colors: ["#3cfffc", "#c6ff00", "#ff3cf5"], skin: "prism" },
            { name: "Synthwave", colors: ["#ff4fc8", "#865dff", "#32c5ff"], skin: "wave" },
            { name: "Deep Ocean", colors: ["#02d6df", "#0b69ff", "#55f0ac"], skin: "ocean" },
            { name: "Ember / Copper", colors: ["#ffb547", "#ff4b28", "#d94dff"], skin: "copper" },
            { name: "Emerald Night", colors: ["#2cff9a", "#c8ff5a", "#12a0a3"], skin: "emerald" },
            { name: "Amethyst", colors: ["#b58aff", "#ff7bcf", "#637bff"], skin: "amethyst" },
            { name: "Glacier", colors: ["#dcffff", "#83c5ff", "#6ffff0"], skin: "ice" },
            { name: "Crimson Sunset", colors: ["#ff335f", "#ff865e", "#ffdd80"], skin: "crimson" }
        ];

        const PALETTE_TRANSITION_MS = 1800;
        const THEME_CSS_PROPERTIES = {
            bg: "--bg-base", rail: "--rail-bg", bar: "--topbar-bg",
            paper: "--paper-bg", ink: "--editor-ink", brand: "--brand-ink",
            chrome: "--chrome-ink", border: "--ui-border", accent: "--ui-accent",
            hint: "--hint-ink", raw: "--raw-ink"
        };

        function hexToRgb(hex) {
            const n = hex.replace("#", "");
            return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255);
        }

        let paletteFrom = NEON_PALETTES[0].colors.map(hexToRgb);
        let paletteTo = NEON_PALETTES[0].colors.map(hexToRgb);
        let paletteTransitionStart = -PALETTE_TRANSITION_MS;
        let themeTimer = null;
        let activeThemeIndex = 0;

        function plasmaColorsAt(now) {
            const progress = Math.max(0, Math.min(1, (now - paletteTransitionStart) / PALETTE_TRANSITION_MS));
            const eased = progress * progress * (3 - 2 * progress);
            return paletteFrom.map((a, i) => a.map((component, j) => component + (paletteTo[i][j] - component) * eased));
        }

        function applyPalette(idx) {
            if (!Number.isInteger(idx) || idx < 0 || idx >= NEON_PALETTES.length) return;
            const now = performance.now();
            // Sample the actual current colors before scheduling a new fade:
            // even fast/manual theme changes cannot create a discontinuity.
            paletteFrom = plasmaColorsAt(now);
            paletteTo = NEON_PALETTES[idx].colors.map(hexToRgb);
            paletteTransitionStart = now;
            activeThemeIndex = idx;

            const root = document.documentElement.style;
            const theme = NEON_PALETTES[idx];
            theme.colors.forEach((color, i) => root.setProperty(["--neon-a", "--neon-b", "--neon-c"][i], color));
            const skin = THEME_SKINS[theme.skin];
            for (const key of Object.keys(THEME_CSS_PROPERTIES)) {
                root.setProperty(THEME_CSS_PROPERTIES[key], skin[key]);
            }
        }

        function shuffleNeonPalette() {
            // Exclude the current palette, so each automatic change is visible.
            const other = Math.floor(Math.random() * (NEON_PALETTES.length - 1));
            const idx = other >= activeThemeIndex ? other + 1 : other;
            applyPalette(idx);
            const sel = document.getElementById("themeSelect");
            if (sel && sel.value === "-1") {
                sel.options[0].text = "Auto Random (" + NEON_PALETTES[idx].name + ")";
            }
        }

        function scheduleAutoTheme() {
            clearTimeout(themeTimer);
            themeTimer = setTimeout(() => {
                shuffleNeonPalette();
                scheduleAutoTheme();
            }, 90000 + Math.random() * 60000);
        }

        function startAutoTheme() {
            clearTimeout(themeTimer);
            shuffleNeonPalette();
            scheduleAutoTheme();
        }

        function changeTheme(saveChoice = true) {
            const sel = document.getElementById("themeSelect");
            const val = Number(sel.value);
            if (val === -1) {
                startAutoTheme();
            } else if (Number.isInteger(val) && val >= 0 && val < NEON_PALETTES.length) {
                clearTimeout(themeTimer);
                themeTimer = null;
                sel.options[0].text = "Auto Random";
                applyPalette(val);
            } else {
                return;
            }
            if (saveChoice) storageSet(THEME_KEY, String(val));
        }

        const selectedTheme = storageGet(THEME_KEY);
        if (selectedTheme !== null && [...document.getElementById("themeSelect").options].some(option => option.value === selectedTheme)) {
            document.getElementById("themeSelect").value = selectedTheme;
        }
        changeTheme(false);

        document.getElementById('themeSelect').addEventListener('change', () => changeTheme());

        editor.addEventListener("keydown", (e) => {
            if (e.key === "Tab") {
                e.preventDefault();
                e.stopPropagation();
                document.execCommand("insertHTML", false, "&#160;&#160;&#160;&#160;");
            }
        }, true);

        // --- Plasma Canvas ---

        const plasmaCv = document.getElementById("plasma-cv");
        const plasmaCtx = plasmaCv.getContext("2d");
        const DPR = window.devicePixelRatio || 1;

        // Low-res offscreen buffer
        const PW = 140, PH = 100;
        const offCv = document.createElement("canvas");
        offCv.width = PW;
        offCv.height = PH;
        const offCtx = offCv.getContext("2d");
        const imgData = offCtx.createImageData(PW, PH);
        const px = imgData.data;

        let plasmaT = 0;

        // All four wave speeds (1, 0.6, 0.8, 1.2) complete an integer
        // number of cycles over 10*PI. Wrapping there is seam-free.
        const PLASMA_PERIOD = 10 * Math.PI;

        function drawPlasma() {
            const cols = plasmaColorsAt(performance.now());
            for (let y = 0; y < PH; y++) {
                for (let x = 0; x < PW; x++) {
                    const nx = x / PW, ny = y / PH;
                    const v =
                        Math.sin(nx * 7 + plasmaT * 1.0) * 0.25 +
                        Math.sin(ny * 5 + plasmaT * 0.6) * 0.25 +
                        Math.sin((nx + ny) * 8 + plasmaT * 0.8) * 0.20 +
                        Math.sin(Math.sqrt((nx - .5) ** 2 + (ny - .5) ** 2) * 11 + plasmaT * 1.2) * 0.30;

                    // blend between the 3 neon palette colours
                    const nv = v * 0.5 + 0.5; // 0..1
                    const seg = nv * 2; // 0..2
                    let r, g, b;
                    if (seg < 1) {
                        r = cols[0][0] * (1 - seg) + cols[1][0] * seg;
                        g = cols[0][1] * (1 - seg) + cols[1][1] * seg;
                        b = cols[0][2] * (1 - seg) + cols[1][2] * seg;
                    } else {
                        const s2 = seg - 1;
                        r = cols[1][0] * (1 - s2) + cols[2][0] * s2;
                        g = cols[1][1] * (1 - s2) + cols[2][1] * s2;
                        b = cols[1][2] * (1 - s2) + cols[2][2] * s2;
                    }

                    const i = (y * PW + x) * 4;
                    px[i] = r * 255 | 0;
                    px[i + 1] = g * 255 | 0;
                    px[i + 2] = b * 255 | 0;
                    px[i + 3] = 255;
                }
            }
            offCtx.putImageData(imgData, 0, 0);
        }

        function resizePlasma() {
            plasmaCv.width = window.innerWidth * DPR;
            plasmaCv.height = window.innerHeight * DPR;
            plasmaCv.style.width = window.innerWidth + "px";
            plasmaCv.style.height = window.innerHeight + "px";
            plasmaCtx.setTransform(1, 0, 0, 1, 0, 0);
            plasmaCtx.scale(DPR, DPR);
        }
        resizePlasma();
        window.addEventListener("resize", resizePlasma);

        function renderPlasma() {
            const W = plasmaCv.width / DPR;
            const H = plasmaCv.height / DPR;

            const scrollY = window.scrollY || document.documentElement.scrollTop;

            // No ctx.filter blur — blur is done via CSS on the element itself (GPU composite, free)
            // Just draw the low-res offscreen scaled up; CSS blur handles the softness
            plasmaCtx.fillStyle = "#000";
            plasmaCtx.fillRect(0, 0, W, H);

            const tileH = H + 200;
            const offsetY = -(scrollY * 0.4) % tileH;
            plasmaCtx.drawImage(offCv, 0, offsetY, W, tileH);
            if (offsetY > -200) plasmaCtx.drawImage(offCv, 0, offsetY - tileH, W, tileH);

            // second pass at lower opacity, different scroll speed — no filter needed
            plasmaCtx.globalAlpha = 0.28;
            const offsetY2 = -(scrollY * 0.25) % tileH;
            plasmaCtx.drawImage(offCv, 0, offsetY2, W, tileH);
            plasmaCtx.globalAlpha = 1.0;
        }

        // Plasma runs on its own interval — completely decoupled from rAF
        // so typing/input never competes with plasma rendering
        setInterval(() => {
            plasmaT = (plasmaT + 0.06) % PLASMA_PERIOD;
            drawPlasma();
            renderPlasma();
        }, 100); // 10fps = 100ms

        // Scroll: only re-render (no redraw of plasma math, just reposition)
        document.querySelector(".wrap").addEventListener("scroll", renderPlasma, { passive: true });

