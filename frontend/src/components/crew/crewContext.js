import { createContext, useContext } from "react";

// 스태프 화면 전체가 같이 보는 값(명단 · 시간표 · 나 · 지금 시각 · 고치기 열기). StaffCrewPage 가 채운다.
export const CrewContext = createContext(null);

export const useCrew = () => useContext(CrewContext);
