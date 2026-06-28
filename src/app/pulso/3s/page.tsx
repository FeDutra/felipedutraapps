'use client';

import React from 'react';
import AtelieWorkspaceV2 from '@/apps/pulso/components/AtelieWorkspaceV2';

export default function Page() {
  const dummyContextNode = {
    areaId: "public_atelie",
    subareaId: "3s",
    contextId: "public_atelie_3s",
    chatId: "public",
    openclawSessionKey: "public",
    label: "3s"
  };

  return (
    <div className="relative w-full h-[100dvh] bg-[#111] overflow-hidden">
      <AtelieWorkspaceV2 activeContextNode={dummyContextNode} isActive={true} />
    </div>
  );
}
