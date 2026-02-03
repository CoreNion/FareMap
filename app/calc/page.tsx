"use client";

import { FareLine, FareStation } from "@/types/fare";
import { calculateFare } from "@/utils/calc";
import { useEffect, useState } from "react";

export default function CalcFareDemoPage() {
  const [stations, setStations] = useState<FareStation[]>([]);
  useEffect(() => {
    const fetchStations = async () => {
      const res = await fetch('/jre/fare/lines/chuo.json');
      const line = (await (res.json())) as FareLine;
      setStations(line.lines[0].stations);
    }
    fetchStations();
  }, []);

  const [fromStation, setFromStation] = useState<string>('');
  const [toStation, setToStation] = useState<string>('');
  const [fare, setFare] = useState<number>(0);

  useEffect(() => {
    const computeFare = async () => {
      const fromSt = stations.find(st => st.id === fromStation);
      const toSt = stations.find(st => st.id === toStation);
      console.log(`From station: ${fromSt?.name}, To station: ${toSt?.name}`);
      if (fromSt && toSt) {
        const f = await calculateFare(fromSt, toSt);
        console.log(`Calculated fare from ${fromSt.name} to ${toSt.name}: ${f}`);
        setFare(f);
      }
    }
    computeFare();
  }, [fromStation, toStation, stations]);

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">運賃計算デモ</h1>
      <form>
        <select className="border p-2 mr-2" value={fromStation} onChange={e => { setFromStation(e.target.value);}} id="from-station">
          {stations.map(station => (
            <option key={station.id} value={station.id}>{station.name}</option>
          ))}
        </select>
        から
        <select className="border p-2 ml-2 mr-4" value={toStation} onChange={e => { setToStation(e.target.value);}} id="to-station">
          {stations.map(station => (
            <option key={station.id} value={station.id}>{station.name}</option>
          ))}
        </select>
        までの運賃:
        <span className="font-bold ml-2">{fare}</span>
      </form>
    </main>
  );
}