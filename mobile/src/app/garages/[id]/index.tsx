import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { setActiveGarage } from '@/data/repo';

/** Opening a garage makes it the active one and shows it on the Garage screen. */
export default function GarageOpen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void setActiveGarage(id).finally(() => setReady(true));
  }, [id]);
  return ready ? <Redirect href="/garage" /> : null;
}
