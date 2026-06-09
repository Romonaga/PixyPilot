import { chromium } from "playwright";

const appUrl = process.env.PIXYPILOT_URL ?? "http://127.0.0.1:5173/";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const logs = [];

page.on("console", (message) => {
  if (["error", "warning"].includes(message.type())) {
    logs.push(`${message.type()}: ${message.text()}`);
  }
});
page.on("pageerror", (error) => logs.push(`pageerror: ${error.message}`));

await page.goto(appUrl, { waitUntil: "networkidle" });
await page.getByText("PixyPilot").waitFor({ state: "visible" });
await page.getByRole("button", { name: /Refresh controls/i }).click();
await page.waitForFunction(() => document.body.innerText.includes("Ready"));
await page.getByRole("heading", { name: "PTZ Control" }).waitFor({ state: "visible" });
await page.getByRole("heading", { name: "Image Control" }).waitFor({ state: "visible" });
await page.getByRole("heading", { name: "Focus Control" }).waitFor({ state: "visible" });
await page.getByRole("heading", { name: "Exposure Control" }).waitFor({ state: "visible" });
await page.getByText("Auto Framing").waitFor({ state: "visible" });
await page.getByText("Speaker Tracking").waitFor({ state: "visible" });
await page.getByText("Gesture Control").waitFor({ state: "visible" });
await page.screenshot({ path: "/tmp/pixypilot-desktop.png", fullPage: false });

await page.setViewportSize({ width: 390, height: 900 });
await page.waitForTimeout(250);
await page.screenshot({ path: "/tmp/pixypilot-mobile.png", fullPage: false });

const bodyText = await page.locator("body").innerText();
const result = {
  title: await page.title(),
  url: page.url(),
  hasPixyPilot: bodyText.includes("PixyPilot"),
  hasPtzControl: bodyText.includes("PTZ Control"),
  hasImageControl: bodyText.includes("Image Control"),
  hasFocusControl: bodyText.includes("Focus Control"),
  hasExposureControl: bodyText.includes("Exposure Control"),
  hasAutoFraming: bodyText.includes("Auto Framing"),
  hasSpeakerTracking: bodyText.includes("Speaker Tracking"),
  hasGestureControl: bodyText.includes("Gesture Control"),
  hasFutureDeck: bodyText.includes("Future Deck"),
  hasReadySignal: bodyText.includes("Ready"),
  rangeCount: await page.locator('input[type="range"]').count(),
  toggleCount: await page.locator(".toggle-switch").count(),
  selectCount: await page.locator("select").count(),
  logs,
  screenshots: ["/tmp/pixypilot-desktop.png", "/tmp/pixypilot-mobile.png"]
};

await browser.close();

if (
  !result.hasPixyPilot ||
  !result.hasPtzControl ||
  !result.hasImageControl ||
  !result.hasFocusControl ||
  !result.hasExposureControl ||
  !result.hasAutoFraming ||
  !result.hasSpeakerTracking ||
  !result.hasGestureControl ||
  !result.hasFutureDeck ||
  !result.hasReadySignal ||
  result.logs.length > 0
) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
