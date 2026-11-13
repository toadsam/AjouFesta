export const AJOU_CENTER = { latitude: 37.2826, longitude: 127.0443 };
export const AJOU_ADDRESS = "경기도 수원시 영통구 월드컵로 206 아주대학교";

function pickPrimaryCity(address) {
  return address.city || address.town || address.village || address.state || "";
}

function pickDistrict(address) {
  return (
    address.city_district ||
    address.borough ||
    address.suburb ||
    address.county ||
    ""
  );
}

export function formatKoreanArea(address) {
  const city = pickPrimaryCity(address);
  const district = pickDistrict(address);
  return [city, district].filter(Boolean).join(" ");
}

export async function reverseGeocodeKoreanShort(latitude, longitude) {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    "accept-language": "ko",
    zoom: "16",
    addressdetails: "1",
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    return AJOU_ADDRESS;
  }

  const data = await response.json();
  const areaText = formatKoreanArea(data.address || {});
  return areaText || data.display_name || AJOU_ADDRESS;
}
