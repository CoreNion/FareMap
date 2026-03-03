"use client";

import { FareLine, FareStation, FareLineInfo, FareLineList } from "@/types/fare";

import { calculateFare } from "@/utils/calc";
import { useEffect, useState, useCallback } from "react";

export default function CalcFareDemoPage() {
  const [lines, setLines] = useState<Array<{name: string; id: string; source: string;}>>([]);

  const [fromLineId, setFromLineId] = useState<string>('');
  const [toLineId, setToLineId] = useState<string>('');

  const [fromStations, setFromStations] = useState<FareStation[]>([]);
  const [toStations, setToStations] = useState<FareStation[]>([]);

  const [fromStation, setFromStation] = useState<string>('');
  const [toStation, setToStation] = useState<string>('');
  const [fare, setFare] = useState<number>(0);

  useEffect(() => {
    const fetchInfo = async () => {
      const res = await fetch('/data/jre/fare/info.json');
      const info = (await res.json()) as FareLineList;
      const merged: Array<{name: string; id: string; source: string}> = [];
      (info.lines || []).forEach((l: FareLineInfo) => {
        merged.push({ name: l.name, id: l.id, source: l.id });
        if (Array.isArray(l.children)) {
          l.children.forEach((c: FareLineInfo) => merged.push({ name: c.name, id: c.id, source: l.id }));
        }
      });
      setLines(merged);
    };
    fetchInfo();
  }, []);

  const getLineFileName = (id: string) => {
    if (!id) return id;
    if (id.startsWith('yamanote')) return 'yamanote';
    return id;
  };

  const resolveFileForLineId = useCallback((lineId: string) => {
    if (!lineId) return '';
    const sel = lines.find(l => l.id === lineId);
    const sourceId = sel?.source || lineId;
    return getLineFileName(sourceId);
  }, [lines]);

  const handleFromLineChange = (value: string) => {
    setFromLineId(value);
    if (!value) {
      setFromStations([]);
      setFromStation('');
    }
  };

  const handleToLineChange = (value: string) => {
    setToLineId(value);
    if (!value) {
      setToStations([]);
      setToStation('');
    }
  };

  useEffect(() => {
    if (!fromLineId) return;
    const fetchLine = async () => {
      try {
        const file = resolveFileForLineId(fromLineId);
        if (!file) return;
        const res = await fetch(`/data/jre/fare/lines/${file}.json`);
        const data = (await res.json()) as FareLine;
        const linesInFile = data.lines || [];
        const entry = linesInFile.find((ln) => ln.id === fromLineId) || linesInFile[0];
        const sts = entry?.stations || [];
        setFromStations(sts);
        setFromStation('');
      } catch {
        setFromStations([]);
        setFromStation('');
      }
    };
    fetchLine();
  }, [fromLineId, resolveFileForLineId]);

  useEffect(() => {
    if (!toLineId) return;
    const fetchLine = async () => {
      try {
        const file = resolveFileForLineId(toLineId);
        if (!file) return;
        const res = await fetch(`/data/jre/fare/lines/${file}.json`);
        const data = (await res.json()) as FareLine;
        const linesInFile = data.lines || [];
        const entry = linesInFile.find((ln) => ln.id === toLineId) || linesInFile[0];
        const sts = entry?.stations || [];
        setToStations(sts);
        setToStation('');
      } catch {
        setToStations([]);
        setToStation('');
      }
    };
    fetchLine();
  }, [toLineId, resolveFileForLineId]);

  useEffect(() => {
    const computeFare = async () => {
      const fromSt = fromStations.find(st => st.id === fromStation);
      const toSt = toStations.find(st => st.id === toStation);
      console.log(`From station: ${fromSt?.name}, To station: ${toSt?.name}`);
      if (fromSt && toSt) {
        const f = await calculateFare(fromSt, toSt);
        console.log(`Calculated fare from ${fromSt.name} to ${toSt.name}: ${f}`);
        setFare(f);
      } else {
        setFare(0);
      }
    };
    computeFare();
  }, [fromStation, toStation, fromStations, toStations]);

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">運賃計算デモ</h1>
      <form>
        <div className="mb-2">
          <label className="mr-2">出発路線:</label>
          <select className="border p-2 mr-4" value={fromLineId} onChange={e => handleFromLineChange(e.target.value)}>
            <option value="">-- 路線を選択 --</option>
            {lines.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <label className="mr-2">出発駅:</label>
          <select className="border p-2" value={fromStation} onChange={e => setFromStation(e.target.value)} disabled={fromStations.length===0} id="from-station">
            <option value="">-- 駅を選択 --</option>
            {fromStations.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>

        <div className="mb-2">
          <label className="mr-2">到着路線:</label>
          <select className="border p-2 mr-4" value={toLineId} onChange={e => handleToLineChange(e.target.value)}>
            <option value="">-- 路線を選択 --</option>
            {lines.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <label className="mr-2">到着駅:</label>
          <select className="border p-2" value={toStation} onChange={e => setToStation(e.target.value)} disabled={toStations.length===0} id="to-station">
            <option value="">-- 駅を選択 --</option>
            {toStations.map(station => (
              <option key={station.id} value={station.id}>{station.name}</option>
            ))}
          </select>
        </div>

        <div>
          までの運賃: <span className="font-bold ml-2">{fare}</span>
        </div>
      </form>
    </main>
  );
}