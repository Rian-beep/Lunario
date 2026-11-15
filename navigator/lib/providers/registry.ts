/** Source roles are explicit; a reference URL is not an installed live provider. */
export const DATA_SOURCE_REGISTRY=[
 {id:'noaa-goes-xray',label:'NOAA GOES X-ray observations',role:'Live observation adapter',url:'https://www.swpc.noaa.gov/products/goes-x-ray-flux'},
 {id:'nasa-sdo',label:'NASA SDO AIA imagery and synoptic maps',role:'Reference display imagery; a rotation map is not an instantaneous whole Sun',url:'https://sdo.gsfc.nasa.gov/data/synoptic/'},
 {id:'jpl-horizons',label:'JPL Horizons',role:'Prepared celestial calculation evidence; no live refresh here',url:'https://ssd.jpl.nasa.gov/horizons/'},
 {id:'nasa-dsn',label:'NASA Deep Space Network',role:'Station/network reference; not a mission allocation',url:'https://www.nasa.gov/communicating-with-missions/dsn/'},
 {id:'jpl-dsn-now',label:'JPL DSN Now',role:'Current activity reference; not a reservation or future schedule',url:'https://www.jpl.nasa.gov/deep-space-network-now/'},
 {id:'open-meteo',label:'Open-Meteo station weather',role:'Existing explicit weather connection; model forecast within actual returned coverage',url:'https://open-meteo.com/en/docs'},
 {id:'nasa-power',label:'NASA POWER',role:'Historical/climatology reference; no selected-date forecast inferred',url:'https://power.larc.nasa.gov/'},
 {id:'upstream',label:'Upstream Earth/Sun source',role:'Reviewed implementation reference; source code is not measured support coverage',url:'https://github.com/Rian-beep/NASA---Space---App-Challenge'},
] as const;
