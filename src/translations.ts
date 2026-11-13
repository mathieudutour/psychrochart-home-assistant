// The card's own strings, in the languages it ships with. Strings Home
// Assistant already translates, such as "Dew point", "Entity not found" and
// the editor's generic labels, come from Home Assistant first, so they
// follow every language it supports; these are their fallbacks.
//
// To add a language, copy the `en` block, translate it and add it to
// STRINGS: the type checker lists any key that is missing.

const en = {
  // Card
  outdoor: "Outdoor",
  readoutTooltip: "Double-click for the sensor's details",
  dewPoint: "Dew point",
  loading: "Loading state history…",
  noHistory: "No state history found.",
  entityNotFound: "Entity not found",
  starting: "Home Assistant is starting. Not everything may be available yet.",
  missingTemperature: "You need to define a temperature entity",
  missingHumidity: "You need to define a humidity entity",
  // Card picker
  cardName: "Psychrometric Chart",
  cardDescription:
    "Plots indoor temperature and humidity history on a psychrometric chart, with a comfort zone.",
  // Visual editor
  temperature: "Indoor temperature",
  humidity: "Indoor humidity",
  hours: "Hours to show",
  outdoorTemperature: "Outdoor temperature (optional)",
  outdoorHumidity: "Outdoor humidity (optional)",
  pressure: "Barometric pressure (optional)",
  outdoorTemperatureHelp:
    "Its mean over the last 30 days positions the comfort zone. Without it, a mean of 19 °C is assumed. Its current reading shows on hover.",
  outdoorHumidityHelp:
    "With the outdoor temperature, shows the outdoor air as a point on hover.",
  pressureHelp:
    "Must report the pressure where you are, not adjusted to sea level. Without it, the pressure at your Home Assistant elevation is used.",
  doubleTapHelp:
    "On the temperature or the humidity. By default, opens that sensor's details.",
  holdHelp: "Anywhere on the card.",
  notText: "{key} must be text, such as an entity ID",
  notAction: "{key} must be an action, such as { action: more-info }",
};

export type StringKey = keyof typeof en;

const fr: Record<StringKey, string> = {
  outdoor: "Extérieur",
  readoutTooltip: "Double-cliquez pour voir les détails du capteur",
  dewPoint: "Point de rosée",
  loading: "Chargement de l'historique…",
  noHistory: "Aucun historique trouvé.",
  entityNotFound: "Entité introuvable",
  starting: "Home Assistant démarre. Tout n'est peut-être pas encore disponible.",
  missingTemperature: "Indiquez une entité de température",
  missingHumidity: "Indiquez une entité d'humidité",
  cardName: "Diagramme psychrométrique",
  cardDescription:
    "Trace l'historique de la température et de l'humidité intérieures sur un diagramme psychrométrique, avec une zone de confort.",
  temperature: "Température intérieure",
  humidity: "Humidité intérieure",
  hours: "Heures à afficher",
  outdoorTemperature: "Température extérieure (facultatif)",
  outdoorHumidity: "Humidité extérieure (facultatif)",
  pressure: "Pression atmosphérique (facultatif)",
  outdoorTemperatureHelp:
    "Sa moyenne sur les 30 derniers jours positionne la zone de confort. Sans capteur, une moyenne de 19 °C est utilisée. Sa valeur actuelle s'affiche au survol.",
  outdoorHumidityHelp:
    "Avec la température extérieure, affiche l'air extérieur sous forme de point au survol.",
  pressureHelp:
    "Doit indiquer la pression là où vous êtes, non ramenée au niveau de la mer. Sans capteur, la pression à l'altitude configurée dans Home Assistant est utilisée.",
  doubleTapHelp:
    "Sur la température ou l'humidité. Par défaut, ouvre les détails de ce capteur.",
  holdHelp: "N'importe où sur la carte.",
  notText: "{key} doit être un texte, par exemple un identifiant d'entité",
  notAction: "{key} doit être une action, par exemple { action: more-info }",
};

const de: Record<StringKey, string> = {
  outdoor: "Außen",
  readoutTooltip: "Doppelklicken für die Details des Sensors",
  dewPoint: "Taupunkt",
  loading: "Verlauf wird geladen…",
  noHistory: "Kein Verlauf gefunden.",
  entityNotFound: "Entität nicht gefunden",
  starting: "Home Assistant wird gestartet. Möglicherweise ist noch nicht alles verfügbar.",
  missingTemperature: "Gib eine Temperatur-Entität an",
  missingHumidity: "Gib eine Luftfeuchtigkeits-Entität an",
  cardName: "Psychrometrisches Diagramm",
  cardDescription:
    "Zeigt den Verlauf von Innentemperatur und Luftfeuchtigkeit in einem psychrometrischen Diagramm, mit Komfortzone.",
  temperature: "Innentemperatur",
  humidity: "Luftfeuchtigkeit innen",
  hours: "Anzuzeigende Stunden",
  outdoorTemperature: "Außentemperatur (optional)",
  outdoorHumidity: "Luftfeuchtigkeit außen (optional)",
  pressure: "Luftdruck (optional)",
  outdoorTemperatureHelp:
    "Ihr Mittelwert der letzten 30 Tage bestimmt die Lage der Komfortzone. Ohne Sensor wird ein Mittelwert von 19 °C angenommen. Der aktuelle Wert erscheint beim Darüberfahren.",
  outdoorHumidityHelp:
    "Zeigt zusammen mit der Außentemperatur die Außenluft beim Darüberfahren als Punkt.",
  pressureHelp:
    "Muss den Luftdruck an deinem Standort melden, nicht auf Meereshöhe umgerechnet. Ohne Sensor wird der Luftdruck der in Home Assistant eingestellten Höhe verwendet.",
  doubleTapHelp:
    "Auf Temperatur oder Luftfeuchtigkeit. Öffnet standardmäßig die Details dieses Sensors.",
  holdHelp: "Überall auf der Karte.",
  notText: "{key} muss Text sein, etwa eine Entitäts-ID",
  notAction: "{key} muss eine Aktion sein, etwa { action: more-info }",
};

const es: Record<StringKey, string> = {
  outdoor: "Exterior",
  readoutTooltip: "Haz doble clic para ver los detalles del sensor",
  dewPoint: "Punto de rocío",
  loading: "Cargando el historial…",
  noHistory: "No se encontró historial.",
  entityNotFound: "Entidad no encontrada",
  starting: "Home Assistant se está iniciando. Puede que todavía no esté todo disponible.",
  missingTemperature: "Indica una entidad de temperatura",
  missingHumidity: "Indica una entidad de humedad",
  cardName: "Diagrama psicrométrico",
  cardDescription:
    "Muestra el historial de temperatura y humedad interiores en un diagrama psicrométrico, con una zona de confort.",
  temperature: "Temperatura interior",
  humidity: "Humedad interior",
  hours: "Horas a mostrar",
  outdoorTemperature: "Temperatura exterior (opcional)",
  outdoorHumidity: "Humedad exterior (opcional)",
  pressure: "Presión atmosférica (opcional)",
  outdoorTemperatureHelp:
    "Su media de los últimos 30 días sitúa la zona de confort. Sin sensor, se toma una media de 19 °C. Su valor actual aparece al pasar el ratón.",
  outdoorHumidityHelp:
    "Junto con la temperatura exterior, muestra el aire exterior como un punto al pasar el ratón.",
  pressureHelp:
    "Debe indicar la presión donde estás, no ajustada al nivel del mar. Sin sensor, se usa la presión a la altitud configurada en Home Assistant.",
  doubleTapHelp:
    "Sobre la temperatura o la humedad. Por defecto, abre los detalles de ese sensor.",
  holdHelp: "En cualquier parte de la tarjeta.",
  notText: "{key} debe ser texto, por ejemplo un ID de entidad",
  notAction: "{key} debe ser una acción, por ejemplo { action: more-info }",
};

const nl: Record<StringKey, string> = {
  outdoor: "Buiten",
  readoutTooltip: "Dubbelklik voor de details van de sensor",
  dewPoint: "Dauwpunt",
  loading: "Geschiedenis laden…",
  noHistory: "Geen geschiedenis gevonden.",
  entityNotFound: "Entiteit niet gevonden",
  starting: "Home Assistant wordt gestart. Mogelijk is nog niet alles beschikbaar.",
  missingTemperature: "Geef een temperatuurentiteit op",
  missingHumidity: "Geef een vochtigheidsentiteit op",
  cardName: "Psychrometrisch diagram",
  cardDescription:
    "Toont het verloop van binnentemperatuur en luchtvochtigheid in een psychrometrisch diagram, met een comfortzone.",
  temperature: "Binnentemperatuur",
  humidity: "Luchtvochtigheid binnen",
  hours: "Te tonen uren",
  outdoorTemperature: "Buitentemperatuur (optioneel)",
  outdoorHumidity: "Luchtvochtigheid buiten (optioneel)",
  pressure: "Luchtdruk (optioneel)",
  outdoorTemperatureHelp:
    "Het gemiddelde van de afgelopen 30 dagen bepaalt de comfortzone. Zonder sensor wordt 19 °C aangenomen. De huidige waarde verschijnt bij aanwijzen.",
  outdoorHumidityHelp:
    "Toont samen met de buitentemperatuur de buitenlucht als punt bij aanwijzen.",
  pressureHelp:
    "Moet de luchtdruk op je locatie geven, niet herleid naar zeeniveau. Zonder sensor wordt de luchtdruk op de hoogte uit Home Assistant gebruikt.",
  doubleTapHelp:
    "Op de temperatuur of de luchtvochtigheid. Opent standaard de details van die sensor.",
  holdHelp: "Overal op de kaart.",
  notText: "{key} moet tekst zijn, zoals een entiteit-ID",
  notAction: "{key} moet een actie zijn, zoals { action: more-info }",
};

export const STRINGS: Record<string, Record<StringKey, string>> = { en, fr, de, es, nl };

/** The parts of `hass` that tell the user's language. */
type LanguageHass = { locale?: { language?: string }; language?: string };

/**
 * The user's language: from `hass` when the card has it, otherwise from the
 * page, as Home Assistant sets `<html lang>` to it.
 */
export function languageOf(hass?: LanguageHass) {
  return (
    hass?.locale?.language ??
    hass?.language ??
    (typeof document !== "undefined" ? document.documentElement.lang : "") ??
    ""
  );
}

/** The strings for a language: exact, else its base language, else English. */
function stringsFor(language: string) {
  const code = language.toLowerCase();
  return STRINGS[code] ?? STRINGS[code.split("-")[0]] ?? en;
}

/** A string in the user's language, with `{name}` placeholders filled in. */
export function translate(
  language: string,
  key: StringKey,
  values: Record<string, string> = {}
) {
  return stringsFor(language)[key].replace(
    /\{(\w+)\}/g,
    (match, name: string) => values[name] ?? match
  );
}
