import { createContext, useContext } from 'react';

export const BottomTabHeightContext = createContext<number | null>(null);

export const useBottomTabHeight = () => useContext(BottomTabHeightContext);
