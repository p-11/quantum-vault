import type { BuildMetadata } from './build-metadata';

export type RuntimeDiagnostics = Readonly<{
  extensionVersion: string;
  buildMetadata: BuildMetadata;
}>;

const unknownRuntimeValue = 'unknown';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const getRecordField = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;

const getExtensionVersion = (): string => {
  const chromeValue = getRecordField(globalThis, 'chrome');
  const runtimeValue = getRecordField(chromeValue, 'runtime');
  const getManifest = getRecordField(runtimeValue, 'getManifest');

  if (typeof getManifest !== 'function') {
    return unknownRuntimeValue;
  }

  const manifestValue = Reflect.apply(getManifest, runtimeValue, []);
  const versionValue = getRecordField(manifestValue, 'version');

  return typeof versionValue === 'string' && versionValue
    ? versionValue
    : unknownRuntimeValue;
};

export const getRuntimeDiagnostics = (): RuntimeDiagnostics => ({
  extensionVersion: getExtensionVersion(),
  buildMetadata: __BUILD_METADATA__
});

const copyFields: ReadonlyArray<{
  label: string;
  getValue: (diagnostics: RuntimeDiagnostics) => string;
}> = [
  {
    label: 'extensionVersion',
    getValue: diagnostics => diagnostics.extensionVersion
  },
  {
    label: 'buildMode',
    getValue: diagnostics => diagnostics.buildMetadata.buildMode
  },
  {
    label: 'runtimeVariant',
    getValue: diagnostics => diagnostics.buildMetadata.runtimeVariant
  },
  {
    label: 'commitSha',
    getValue: diagnostics => diagnostics.buildMetadata.commitSha
  },
  {
    label: 'appVersion',
    getValue: diagnostics => diagnostics.buildMetadata.appVersion
  },
  {
    label: 'libqcDependencySpec',
    getValue: diagnostics => diagnostics.buildMetadata.libqcDependencySpec
  },
  {
    label: 'libqcResolvedVersion',
    getValue: diagnostics => diagnostics.buildMetadata.libqcResolvedVersion
  }
];

type FormatRuntimeDiagnosticsForCopyInput = {
  diagnostics: RuntimeDiagnostics;
  generatedAt: string;
};

export const formatRuntimeDiagnosticsForCopy = ({
  diagnostics,
  generatedAt
}: FormatRuntimeDiagnosticsForCopyInput): string =>
  [
    'Quantum Vault diagnostics',
    `generatedAt: ${generatedAt}`,
    ...copyFields.map(field => `${field.label}: ${field.getValue(diagnostics)}`)
  ].join('\n');
