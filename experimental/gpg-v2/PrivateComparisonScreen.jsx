import React from 'react';
import PrivateGpgPreview from './PrivateGpgPreview';
import connection from './privateConnection.cjs';

// Nessuna cache, promise, effect, rete o storage: ad ogni render soltanto i props correnti.
export default function PrivateComparisonScreen({ platform, config, operator, accountId, profileRole,
  year, monthIndex, records, grossEuro, netEstimateEuro, onClose }) {
  if (!connection.canOpenPrivatePreview({ platform, config, operator, accountId, profileRole })) return null;
  const result = connection.previewResult({ platform, config, operator, accountId, profileRole,
    year, monthIndex, records, grossEuro, netEstimateEuro });
  return <PrivateGpgPreview operator="gpg" result={result} onClose={onClose} />;
}
