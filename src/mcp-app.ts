import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ===== App Setup =====
const app = new App({ name: "Color Palette Generator", version: "1.0.0" });

// ===== State =====
let currentBaseColor = "#3498db";
let currentPaletteType = "analogous";
let currentPalette: Array<{ hex: string; name: string }> = [];
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ===== DOM References =====
let paletteContainer: HTMLDivElement;
let contrastResultsContainer: HTMLDivElement;
let toastEl: HTMLDivElement;
let hexDisplay: HTMLSpanElement;
let colorInput: HTMLInputElement;

// ===== Palette Types =====
const paletteTypes = [
  { id: "complementary", label: "Complementary" },
  { id: "analogous", label: "Analogous" },
  { id: "triadic", label: "Triadic" },
  { id: "monochromatic", label: "Monochromatic" },
  { id: "split-complementary", label: "Split Compl." },
];

// ===== Toast =====
const showToast = (message: string) => {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => {
    toastEl.classList.remove("show");
  }, 1800);
};

// ===== Copy to Clipboard =====
const copyHex = async (hex: string, swatchEl: HTMLElement) => {
  try {
    await navigator.clipboard.writeText(hex);
    swatchEl.classList.add("copied");
    showToast(`Copied ${hex}`);
    setTimeout(() => {
      swatchEl.classList.remove("copied");
    }, 1500);
  } catch {
    showToast("Failed to copy");
  }
};

// ===== Render Palette =====
const renderPalette = (colors: Array<{ hex: string; name: string }>) => {
  currentPalette = colors;
  paletteContainer.innerHTML = "";

  colors.forEach((color) => {
    const swatch = document.createElement("div");
    swatch.className = "swatch";

    const colorBlock = document.createElement("div");
    colorBlock.className = "swatch-color";
    colorBlock.style.backgroundColor = color.hex;

    const info = document.createElement("div");
    info.className = "swatch-info";

    const hexText = document.createElement("div");
    hexText.className = "swatch-hex";
    hexText.textContent = color.hex.toUpperCase();

    const nameText = document.createElement("div");
    nameText.className = "swatch-name";
    nameText.textContent = color.name;

    info.appendChild(hexText);
    info.appendChild(nameText);
    swatch.appendChild(colorBlock);
    swatch.appendChild(info);

    swatch.addEventListener("click", () => {
      copyHex(color.hex, swatch);
    });

    paletteContainer.appendChild(swatch);
  });

  // Check contrast between adjacent colors
  if (colors.length >= 2) {
    renderContrastResults(colors);
  }
};

// ===== Contrast Helpers =====
const renderContrastResults = (
  colors: Array<{ hex: string; name: string }>,
) => {
  contrastResultsContainer.innerHTML = "";

  for (let i = 0; i < colors.length - 1; i++) {
    const ratio = calculateContrastRatio(colors[i].hex, colors[i + 1].hex);
    const passAA = ratio >= 4.5;

    const result = document.createElement("div");
    result.className = "contrast-result";

    const pair = document.createElement("div");
    pair.className = "contrast-pair";

    const dot1 = document.createElement("span");
    dot1.className = "contrast-dot";
    dot1.style.backgroundColor = colors[i].hex;

    const dot2 = document.createElement("span");
    dot2.className = "contrast-dot";
    dot2.style.backgroundColor = colors[i + 1].hex;

    pair.appendChild(dot1);
    pair.appendChild(dot2);

    const ratioText = document.createElement("span");
    ratioText.className = "contrast-ratio";
    ratioText.textContent = `${ratio.toFixed(2)}:1`;

    const badge = document.createElement("span");
    badge.className = `wcag-badge ${passAA ? "pass" : "fail"}`;
    badge.textContent = passAA ? "AA Pass" : "AA Fail";

    result.appendChild(pair);
    result.appendChild(ratioText);
    result.appendChild(badge);
    contrastResultsContainer.appendChild(result);
  }
};

const hexToRgb = (hex: string): [number, number, number] => {
  const cleaned = hex.replace("#", "");
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ];
};

const relativeLuminance = (r: number, g: number, b: number): number => {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
};

const calculateContrastRatio = (hex1: string, hex2: string): number => {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// ===== Generate Palette (server call) =====
const generatePalette = async () => {
  try {
    const result: CallToolResult = await app.callServerTool({
      name: "generate-palette",
      arguments: {
        baseColor: currentBaseColor,
        paletteType: currentPaletteType,
      },
    });

    const textContent = result.content?.find((c: any) => c.type === "text");
    if (textContent && "text" in textContent) {
      const data = JSON.parse(textContent.text);
      renderPalette(data.colors);
    }
  } catch (err) {
    console.error("Failed to generate palette:", err);
  }
};

// ===== Check Contrast (server call) =====
const checkContrast = async (color1: string, color2: string) => {
  try {
    const result: CallToolResult = await app.callServerTool({
      name: "check-contrast",
      arguments: { color1, color2 },
    });

    const textContent = result.content?.find((c: any) => c.type === "text");
    if (textContent && "text" in textContent) {
      return JSON.parse(textContent.text);
    }
  } catch (err) {
    console.error("Failed to check contrast:", err);
  }
  return null;
};

// Make checkContrast available on window for potential host use
(window as any).checkContrast = checkContrast;

// ===== Build UI =====
const buildUI = () => {
  const appEl = document.getElementById("app")!;
  appEl.innerHTML = "";

  const container = document.createElement("div");
  container.className = "app";

  // Header
  const header = document.createElement("div");
  header.className = "header";
  const h1 = document.createElement("h1");
  h1.textContent = "Color Palette Generator";
  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Generate harmonious color palettes from any base color";
  header.appendChild(h1);
  header.appendChild(subtitle);

  // Controls
  const controls = document.createElement("div");
  controls.className = "controls";

  // Color picker section
  const colorPickerSection = document.createElement("div");
  colorPickerSection.className = "color-picker-section";

  const label = document.createElement("label");
  label.textContent = "Base";

  colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = currentBaseColor;

  hexDisplay = document.createElement("span");
  hexDisplay.className = "hex-display";
  hexDisplay.textContent = currentBaseColor.toUpperCase();

  colorPickerSection.appendChild(label);
  colorPickerSection.appendChild(colorInput);
  colorPickerSection.appendChild(hexDisplay);

  // Palette type buttons
  const paletteTypesContainer = document.createElement("div");
  paletteTypesContainer.className = "palette-types";

  paletteTypes.forEach((pt) => {
    const btn = document.createElement("button");
    btn.className = `palette-type-btn${pt.id === currentPaletteType ? " active" : ""}`;
    btn.textContent = pt.label;
    btn.dataset.type = pt.id;

    btn.addEventListener("click", () => {
      currentPaletteType = pt.id;
      paletteTypesContainer
        .querySelectorAll(".palette-type-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      generatePalette();
    });

    paletteTypesContainer.appendChild(btn);
  });

  controls.appendChild(colorPickerSection);
  controls.appendChild(paletteTypesContainer);

  // Palette display
  paletteContainer = document.createElement("div");
  paletteContainer.className = "palette-display";

  // Contrast section
  const contrastSection = document.createElement("div");
  contrastSection.className = "contrast-section";
  const contrastTitle = document.createElement("h3");
  contrastTitle.textContent = "Contrast Ratios";
  contrastResultsContainer = document.createElement("div");
  contrastResultsContainer.className = "contrast-results";
  contrastSection.appendChild(contrastTitle);
  contrastSection.appendChild(contrastResultsContainer);

  // Toast
  toastEl = document.createElement("div");
  toastEl.className = "toast";

  // Assemble
  container.appendChild(header);
  container.appendChild(controls);
  container.appendChild(paletteContainer);
  container.appendChild(contrastSection);
  appEl.appendChild(container);
  appEl.appendChild(toastEl);

  // Event: color picker input with debounce
  colorInput.addEventListener("input", () => {
    currentBaseColor = colorInput.value;
    hexDisplay.textContent = currentBaseColor.toUpperCase();

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      generatePalette();
    }, 150);
  });
};

// ===== App Event Handlers =====
app.ontoolresult = (result: CallToolResult) => {
  const textContent = result.content?.find((c: any) => c.type === "text");
  if (textContent && "text" in textContent) {
    try {
      const data = JSON.parse(textContent.text);
      if (data.colors) {
        renderPalette(data.colors);
      }
    } catch {
      // Not a palette result, ignore
    }
  }
};

app.ontoolinput = (input: any) => {
  if (input?.params) {
    if (input.params.baseColor && colorInput) {
      currentBaseColor = input.params.baseColor;
      colorInput.value = currentBaseColor;
      hexDisplay.textContent = currentBaseColor.toUpperCase();
    }
    if (input.params.paletteType) {
      currentPaletteType = input.params.paletteType;
      document.querySelectorAll(".palette-type-btn").forEach((btn) => {
        const el = btn as HTMLElement;
        el.classList.toggle("active", el.dataset.type === currentPaletteType);
      });
    }
  }
};

app.onhostcontextchanged = (ctx: any) => {
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles) applyHostStyleVariables(ctx.styles);
  if (ctx?.fonts) applyHostFonts(ctx.fonts);
};

app.onerror = (error: Error) => {
  console.error("MCP App error:", error);
};

// ===== Initialize =====
buildUI();

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx?.theme) applyDocumentTheme(ctx.theme);
  if (ctx?.styles) applyHostStyleVariables(ctx.styles);
  if (ctx?.fonts) applyHostFonts(ctx.fonts);
  generatePalette();
});
