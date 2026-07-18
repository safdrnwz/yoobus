/** The GPS providers Yoo Bus can integrate with. Fixed list; SuperAdmin switches each on/off. */
export const SUPPORTED_GPS_PROVIDERS = [
  'Fleetx', 'LocoNav', 'Traccar', 'Wialon', 'Ajjas', 'BlackBox GPS', 'Mappls InTouch', 'Custom API',
] as const;

export type GpsProviderName = (typeof SUPPORTED_GPS_PROVIDERS)[number];
