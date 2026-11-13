// 부스에 사진이 없을 때 쓰는 기본 사진. 이번 축제 주점은 총학 주점 하나라 총학생회 단체 사진을 쓴다.
const DEFAULT_BOOTH_IMAGE = "/images/booths/council-pub.webp";

export function resolveBoothImageUrl(booth) {
  return booth?.imageUrl || DEFAULT_BOOTH_IMAGE;
}
