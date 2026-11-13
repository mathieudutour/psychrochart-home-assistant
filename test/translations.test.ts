import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { configForm } from "../src/setup";
import { STRINGS, languageOf, translate } from "../src/translations";

describe("translations", () => {
  const keys = Object.keys(STRINGS.en).sort();

  for (const [language, strings] of Object.entries(STRINGS)) {
    it(`${language} has every string, with the same placeholders`, () => {
      assert.deepEqual(Object.keys(strings).sort(), keys);
      for (const key of keys) {
        const text = strings[key as keyof typeof strings];
        assert.ok(text.trim(), `${language}.${key} is empty`);
        const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        assert.deepEqual(
          placeholders(text),
          placeholders(STRINGS.en[key as keyof typeof strings]),
          `${language}.${key}`
        );
      }
    });
  }

  it("matches a regional language to its base, else falls back to English", () => {
    assert.equal(translate("fr", "outdoor"), "Extérieur");
    assert.equal(translate("fr-CA", "outdoor"), "Extérieur");
    assert.equal(translate("DE", "outdoor"), "Außen");
    assert.equal(translate("pt-BR", "outdoor"), "Outdoor");
    assert.equal(translate("", "outdoor"), "Outdoor");
  });

  it("fills in placeholders", () => {
    assert.equal(
      translate("fr", "notText", { key: "pressure" }),
      "pressure doit être un texte, par exemple un identifiant d'entité"
    );
  });

  it("takes the language from hass first", () => {
    assert.equal(languageOf({ locale: { language: "nl" }, language: "en" }), "nl");
    assert.equal(languageOf({ language: "es" }), "es");
  });
});

describe("editor labels", () => {
  const form = configForm();
  const label = (name: string, localize?: (key: string) => string) =>
    form.computeLabel({ name }, localize);

  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("leaves generic fields to Home Assistant's own translations", () => {
    for (const name of ["name", "interactions", "double_tap_action", "hold_action"]) {
      assert.equal(label(name), undefined, name);
    }
  });

  it("uses Home Assistant's translation of the hours label", () => {
    const localize = (key: string) =>
      key === "ui.panel.lovelace.editor.card.generic.hours_to_show" ? "Heures à afficher" : "";
    assert.equal(label("hours", localize), "Heures à afficher");
    assert.equal(label("hours"), "Hours to show");
  });

  it("follows the page's language, which Home Assistant sets", () => {
    (globalThis as { document?: unknown }).document = { documentElement: { lang: "fr" } };
    assert.equal(label("temperature"), "Température intérieure");
    assert.equal(
      form.computeHelper({ name: "hold_action" }),
      "N'importe où sur la carte."
    );
  });
});
