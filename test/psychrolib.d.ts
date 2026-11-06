// PsychroLib ships without types. Only what the tests use is declared.
declare module "psychrolib" {
  const psychrolib: {
    SI: number;
    SetUnitSystem(unitSystem: number): void;
    /** Humidity ratio in kg/kg, from °C, RH in 0–1 and pressure in Pa. */
    GetHumRatioFromRelHum(
      dryBulb: number,
      relativeHumidity: number,
      pressure: number
    ): number;
  };
  export default psychrolib;
}
