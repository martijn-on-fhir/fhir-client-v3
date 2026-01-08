/**
 * FHIR Templates for Complex Types
 *
 * Pre-defined JSON structures for common FHIR complex types
 * Used by autocomplete to insert properly structured objects
 */

export const FHIR_TEMPLATES: Record<string, any> = {
  CodeableConcept: {
    coding: [
      {
        system: '',
        code: '',
        display: '',
      },
    ],
    text: '',
  },

  Coding: {
    system: '',
    code: '',
    display: '',
  },

  Identifier: {
    system: '',
    value: '',
  },

  Reference: {
    reference: '',
    display: '',
  },

  HumanName: {
    use: '',
    family: '',
    given: [''],
  },

  Address: {
    use: '',
    line: [''],
    city: '',
    postalCode: '',
    country: '',
  },

  ContactPoint: {
    system: '',
    value: '',
    use: '',
  },

  Period: {
    start: '',
    end: '',
  },

  Quantity: {
    value: 0,
    unit: '',
    system: 'http://unitsofmeasure.org',
    code: '',
  },

  Range: {
    low: {
      value: 0,
      unit: '',
    },
    high: {
      value: 0,
      unit: '',
    },
  },

  Ratio: {
    numerator: {
      value: 0,
      unit: '',
    },
    denominator: {
      value: 0,
      unit: '',
    },
  },

  Attachment: {
    contentType: '',
    url: '',
    title: '',
  },

  Annotation: {
    text: '',
  },

  Timing: {
    repeat: {
      frequency: 1,
      period: 1,
      periodUnit: 'd',
    },
  },

  Signature: {
    type: [
      {
        system: 'urn:iso-astm:E1762-95:2013',
        code: '',
      },
    ],
    when: '',
    who: {
      reference: '',
    },
  },

  Meta: {
    profile: [''],
  },

  Extension: {
    url: '',
    valueString: '',
  },

  // Backbone elements for common resources

  'Patient.contact': {
    relationship: [
      {
        coding: [
          {
            system: '',
            code: '',
          },
        ],
      },
    ],
    name: {
      family: '',
      given: [''],
    },
    telecom: [
      {
        system: '',
        value: '',
      },
    ],
  },

  'Patient.communication': {
    language: {
      coding: [
        {
          system: 'urn:ietf:bcp:47',
          code: '',
        },
      ],
    },
    preferred: false,
  },

  'Observation.component': {
    code: {
      coding: [
        {
          system: '',
          code: '',
        },
      ],
    },
    valueQuantity: {
      value: 0,
      unit: '',
      system: 'http://unitsofmeasure.org',
      code: '',
    },
  },

  'Observation.referenceRange': {
    low: {
      value: 0,
      unit: '',
    },
    high: {
      value: 0,
      unit: '',
    },
  },
};

/**
 * Get template for a FHIR type
 */
export function getTemplate(typeName: string): any | null {
  return FHIR_TEMPLATES[typeName] || FHIR_TEMPLATES[typeName.toLowerCase()] || null;
}
