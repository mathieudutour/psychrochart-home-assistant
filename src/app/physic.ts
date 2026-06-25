export function relativeHumidityToAbsoluteHumidity(
  temperature: number,
  relativeHumidity: number
) {
  return 0.01 * relativeHumidity * getSaturationPoint(temperature);
}

function celsiusToKelvin(tempInCelcius: number) {
  return tempInCelcius + 273.15;
}

function getAtmPressureInPascal() {
  // TODO: get real atm pressure
  const i = 101.365;
  return 1e3 * i;
}

function ASHRAE_SatVapPres(temperature: number) {
  let e: number;
  const i = celsiusToKelvin(temperature);
  if (temperature >= -100 && temperature <= 0)
    e =
      -5674.5359 / i +
      6.3925247 -
      0.009677843 * i +
      6.2215701e-7 * i * i +
      2.0747825e-9 * Math.pow(i, 3) -
      9.484024e-13 * Math.pow(i, 4) +
      4.1635019 * Math.log(i);
  else {
    if (!(temperature > 0 && temperature <= 200)) return -99999;
    e =
      -5800.2206 / i +
      1.3914993 -
      0.048640239 * i +
      41764768e-12 * i * i -
      1.4452093e-8 * Math.pow(i, 3) +
      6.5459673 * Math.log(i);
  }
  return Math.exp(e);
}

function getSaturationHumidityRatio(temperature: number) {
  const pressure = getAtmPressureInPascal();
  const i = ASHRAE_SatVapPres(temperature);
  return (0.621945 * i) / (pressure - i);
}

function convertHumidityRatioToAbsoluteHumidity(humRatio: number) {
  return 1e3 * humRatio;
}

export function getSaturationPoint(temperature: number) {
  const satHumRatio = getSaturationHumidityRatio(temperature);
  return convertHumidityRatioToAbsoluteHumidity(satHumRatio);
}
