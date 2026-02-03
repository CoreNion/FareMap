import { FareStation, JrFareData } from "@/types/fare"
import { SUPPORTED_RAILWAY } from "../types/railway"

const distanceToFare = async (distance: number, railway: SUPPORTED_RAILWAY): Promise<number> => {
  let fareData: JrFareData;
  switch (railway) {
    case 'jre':
      fareData = await fetch('/jre/fare/2026.json').then(res => res.json()) as JrFareData;
      break;
    default:
      throw new Error(`未定義の鉄道会社です: ${railway}`);
  }

  let fare = 0;

  // 1km未満は1kmとして扱い、1km以上は端数を切り上げる
  if (distance % 10 !== 0) {
    distance = distance < 10 ? 10 : Math.floor(distance / 10) * 10;
  }
  
  for (const range of fareData.kansen) {
    if (distance >= (range.startK * 10) && distance <= (range.endK * 10)) {
      fare = range.fare;
      break;
    }
  }
  return fare;
}

export const calculateFare = async (startSt: FareStation, endSt: FareStation): Promise<number> => {
  const distance = Math.abs(endSt.km - startSt.km);
  const fare = await distanceToFare(distance, 'jre');
  return fare;
}