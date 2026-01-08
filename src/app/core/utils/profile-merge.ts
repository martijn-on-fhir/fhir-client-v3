/**
 * Profile Merge Service
 *
 * Provides utilities for merging FHIR StructureDefinition elements from
 * inheritance chains (snapshot + differential).
 */

export interface MergedElement {
  path: string;
  min: number;
  max: string;
  type?: any[];
  short?: string;
  definition?: string;
  constraint?: any[];
  mustSupport?: boolean;
  references?: string[];
}

export interface Constraint {
  key: string;
  severity: string;
  path: string;
  human: string;
}

/**
 * Extract target resource types from Reference type definitions
 */
const extractTargetTypes = (type: { code: string; targetProfile?: string | string[] }[]): string[] => {
  if (!type) return [];

  return type
    .map((t) => {
      if (t.code === 'Reference') {
        const profiles = Array.isArray(t.targetProfile) ? t.targetProfile : [t.targetProfile];
        return profiles.map((profileUrl) => {
          if (!profileUrl) return undefined;
          let resource = profileUrl.split('/').reverse()[0];
          if (resource.startsWith('nl-core-')) {
            const name = resource.replace('nl-core-', '');
            resource = name.charAt(0).toUpperCase() + name.slice(1);
          }
          return resource;
        });
      }
      return undefined;
    })
    .flat()
    .filter((item) => item !== undefined) as string[];
};

/**
 * Merge snapshot and differential elements from a profile and its base chain
 */
export function mergeProfileElements(profile: any, baseChain: any[]): MergedElement[] {
  const elementMap = new Map<string, any>();

  // Start with base definitions (bottom-up, so we can merge/override)
  [...baseChain].reverse().forEach((baseDef) => {
    const elements = baseDef.snapshot?.element || [];
    elements.forEach((element: any) => {
      const references = extractTargetTypes(element.type);
      if (!elementMap.has(element.path)) {
        elementMap.set(element.path, { ...element, references });
      } else {
        const existing = elementMap.get(element.path);
        elementMap.set(element.path, {
          ...existing,
          ...element,
          min: element.min !== undefined ? element.min : existing.min,
          max: element.max !== undefined ? element.max : existing.max,
          type: element.type || existing.type,
          short: element.short || existing.short,
          definition: element.definition || existing.definition,
          references: references.length > 0 ? references : existing.references,
        });
      }
    });
  });

  // Apply differential from base definitions
  [...baseChain].reverse().forEach((baseDef) => {
    const diffElements = baseDef.differential?.element || [];
    diffElements.forEach((element: any) => {
      const references = extractTargetTypes(element.type);
      if (!elementMap.has(element.path)) {
        elementMap.set(element.path, { ...element, references });
      } else {
        const existing = elementMap.get(element.path);
        elementMap.set(element.path, {
          ...existing,
          min: element.min !== undefined ? element.min : existing.min,
          max: element.max !== undefined ? element.max : existing.max,
          type: element.type || existing.type,
          short: element.short || existing.short,
          definition: element.definition || existing.definition,
          constraint: element.constraint || existing.constraint,
          references: references.length > 0 ? references : existing.references,
        });
      }
    });
  });

  // Apply current profile snapshot (if exists)
  const currentSnapshot = profile.snapshot?.element || [];
  currentSnapshot.forEach((element: any) => {
    const references = extractTargetTypes(element.type);
    if (!elementMap.has(element.path)) {
      elementMap.set(element.path, { ...element, references });
    } else {
      const existing = elementMap.get(element.path);
      elementMap.set(element.path, {
        ...existing,
        ...element,
        references: references.length > 0 ? references : existing.references,
      });
    }
  });

  // Apply current profile differential (overrides everything)
  const currentDiff = profile.differential?.element || [];
  currentDiff.forEach((element: any) => {
    const references = extractTargetTypes(element.type);
    if (!elementMap.has(element.path)) {
      elementMap.set(element.path, { ...element, references });
    } else {
      const existing = elementMap.get(element.path);
      elementMap.set(element.path, {
        ...existing,
        min: element.min !== undefined ? element.min : existing.min,
        max: element.max !== undefined ? element.max : existing.max,
        type: element.type || existing.type,
        short: element.short || existing.short,
        definition: element.definition || existing.definition,
        constraint: element.constraint || existing.constraint,
        mustSupport: element.mustSupport !== undefined ? element.mustSupport : existing.mustSupport,
        references: references.length > 0 ? references : existing.references,
      });
    }
  });

  const allElements = Array.from(elementMap.values());

  // Filter out Resource and DomainResource elements
  const filteredElements = allElements.filter((element: any) => {
    const path = element.path || '';
    return !path.startsWith('Resource') && !path.startsWith('DomainResource');
  });

  return filteredElements;
}

/**
 * Extract all constraints from a profile and its base chain
 */
export function extractConstraints(profile: any, baseChain: any[]): Constraint[] {
  const elementMap = new Map<string, any>();

  // Collect from base definitions
  [...baseChain].reverse().forEach((baseDef) => {
    const elements = baseDef.snapshot?.element || [];
    elements.forEach((element: any) => {
      if (!elementMap.has(element.path)) {
        elementMap.set(element.path, { ...element });
      }
    });
  });

  // Apply differentials
  [...baseChain].reverse().forEach((baseDef) => {
    const diffElements = baseDef.differential?.element || [];
    diffElements.forEach((element: any) => {
      if (elementMap.has(element.path)) {
        const existing = elementMap.get(element.path);
        elementMap.set(element.path, {
          ...existing,
          constraint: element.constraint || existing.constraint,
        });
      }
    });
  });

  // Apply current profile
  const currentSnapshot = profile.snapshot?.element || [];
  currentSnapshot.forEach((element: any) => {
    elementMap.set(element.path, { ...element });
  });

  const currentDiff = profile.differential?.element || [];
  currentDiff.forEach((element: any) => {
    if (elementMap.has(element.path)) {
      const existing = elementMap.get(element.path);
      elementMap.set(element.path, {
        ...existing,
        constraint: element.constraint || existing.constraint,
      });
    }
  });

  const allElements = Array.from(elementMap.values());
  const constraints = allElements
    .filter((el: any) => el.constraint && el.constraint.length > 0)
    .flatMap((el: any) => el.constraint.map((c: any) => ({ ...c, path: el.path })))
    .sort((a: any, b: any) => {
      const keyA = a.key || '';
      const keyB = b.key || '';
      return keyA.localeCompare(keyB);
    });

  return constraints;
}
