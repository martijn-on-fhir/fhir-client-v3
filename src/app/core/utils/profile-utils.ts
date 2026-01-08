/**
 * Shared Profile Utilities
 *
 * Common utilities and helper functions for displaying and managing
 * FHIR StructureDefinitions.
 */

/**
 * Format element path with tree-style visualization
 */
export function formatElementPath(path: string, index: number, allElements: any[]): string {
  const parts = path.split('.');
  const depth = parts.length - 1;
  const name = parts[parts.length - 1];

  if (depth === 0) {
    return name;
  }

  let prefix = '';
  const parentPath = parts.slice(0, -1).join('.');
  const siblings = allElements.filter((el) => {
    const elParts = el.path.split('.');
    const elParent = elParts.slice(0, -1).join('.');
    return elParent === parentPath && elParts.length === parts.length;
  });

  const isLastSibling = siblings.indexOf(allElements[index]) === siblings.length - 1;

  for (let i = 1; i < depth; i++) {
    const ancestorPath = parts.slice(0, i + 1).join('.');
    const ancestorParentPath = parts.slice(0, i).join('.');
    const ancestorSiblings = allElements.filter((el) => {
      const elParts = el.path.split('.');
      const elParent = elParts.slice(0, i).join('.');
      return elParent === ancestorParentPath && elParts.length === i + 1;
    });

    const ancestorIndex = ancestorSiblings.findIndex((el) => el.path === ancestorPath);
    const hasMoreSiblings = ancestorIndex < ancestorSiblings.length - 1;
    const hasDescendantsAfter = allElements.slice(index + 1).some((el) => {
      const elParts = el.path.split('.');
      const elAncestor = elParts.slice(0, i).join('.');
      return elAncestor === ancestorParentPath && el.path !== path;
    });

    prefix += hasMoreSiblings || hasDescendantsAfter ? '│  ' : '   ';
  }

  prefix += isLastSibling ? '└─ ' : '├─ ';
  return prefix + name;
}

/**
 * Load cache statistics from electron API
 */
export async function loadCacheStats(): Promise<any> {
  try {
    const stats = await window.electronAPI?.profileCache?.stats();
    return stats;
  } catch (error) {
    console.error('Failed to load cache stats:', error);
    return null;
  }
}

/**
 * Extract constraints from snapshot elements
 */
export function extractConstraintsFromElements(elements: any[]): any[] {
  return elements
    .filter((el: any) => el.constraint && el.constraint.length > 0)
    .flatMap((el: any) => el.constraint.map((c: any) => ({ ...c, path: el.path })))
    .sort((a: any, b: any) => (a.key || '').localeCompare(b.key || ''));
}

/**
 * Render type information for an element
 */
export function renderElementType(element: any): string {
  if (element.references && element.references.filter(Boolean).length > 0) {
    return element.references.filter(Boolean).join(', ');
  } else if (element.type && element.type.length > 0) {
    return element.type.map((t: any) => t.code).join(', ');
  } else {
    return '-';
  }
}

/**
 * Get badge class name based on cardinality
 */
export function getCardinalityBadgeClass(min: number, max: string): string {
  const isRequired = min > 0;
  const isForbidden = max === '0';
  if (isRequired) return 'bg-warning';
  if (isForbidden) return 'bg-danger';
  return 'bg-secondary';
}

/**
 * Get severity badge class name
 */
export function getSeverityBadgeClass(severity: string): string {
  return severity === 'error' ? 'bg-danger' : 'bg-warning';
}
