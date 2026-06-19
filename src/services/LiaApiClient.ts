// Cliente de la API del consultório (https://lia.hubilityai.com).
// Auth por header `x-api-key`. Las respuestas vienen como { data: ... } y los
// errores como { error: "mensaje" }; este cliente desenvuelve `data` y lanza con
// el mensaje de la API. El paciente se identifica SIEMPRE por teléfono.

export interface LiaApiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface Appointment {
  id: string;
  patientId: string;
  catalogItemId: string | null;
  title: string;
  startsAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  catalogItem?: CatalogItem | null;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  birthDate: string | null;
  recordNumber: string | null;
  notes: string | null;
}

export interface Availability {
  durationMinutes: number;
  slots: string[];
}

export interface QuoteLine {
  id: string;
  quoteId: string;
  catalogItemId: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface Quote {
  id: string;
  patientId: string;
  number: string;
  issueDate: string;
  paymentMethod: string | null;
  validityDays: number | null;
  discountCents: number;
  notes: string | null;
  patient?: Patient | null;
  lines?: QuoteLine[];
}

export interface Prescription {
  id: string;
  patientId: string;
  issueDate: string;
  notes: string | null;
  patient?: Patient | null;
}

export interface MedicalCertificate {
  id: string;
  patientId: string;
  issueDate: string;
  absenceStartDate: string;
  absenceEndDate: string;
  cid: string;
  city: string;
  notes: string | null;
  patient?: Patient | null;
}

export interface QuoteLineInput {
  catalogItemId?: string | null;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreateQuoteInput {
  patientId: string;
  issueDate: string;
  paymentMethod?: string | null;
  validityDays?: number | null;
  discountCents: number;
  notes?: string | null;
  lines: QuoteLineInput[];
}

export interface PrescriptionItemInput {
  medicine: string;
  instructions: string;
  position: number;
}

export interface CreatePrescriptionInput {
  patientId: string;
  issueDate: string;
  notes?: string | null;
  items: PrescriptionItemInput[];
}

export interface CreateCertificateInput {
  patientId: string;
  issueDate: string;
  absenceStartDate: string;
  absenceEndDate: string;
  cid: string;
  city: string;
  notes?: string | null;
}

export type PatientContext =
  | { isPatient: false }
  | {
      isPatient: true;
      patient: { id: string; name: string; phone: string };
      upcomingAppointments: Appointment[];
      lastQuote: unknown | null;
      lastPrescription: unknown | null;
      activeCertificates: unknown[];
    };

export interface CreatePatientInput {
  name: string;
  phone: string;
  email?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  recordNumber?: string | null;
  notes?: string | null;
}

export interface CreateAppointmentInput {
  phone: string;
  startsAt: string;
  catalogItemId?: string;
  durationMinutes?: number;
  title?: string;
  notes?: string;
}

export interface RescheduleAppointmentInput {
  startsAt?: string;
  durationMinutes?: number;
}

export class LiaApiClient {
  constructor(private config: LiaApiConfig) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let payload: any = null;
    try {
      payload = await res.json();
    } catch {
      // sin cuerpo (p. ej. respuestas vacías)
    }

    if (!res.ok) {
      const message = payload?.error ?? `${method} ${path} falló (HTTP ${res.status})`;
      throw new Error(message);
    }

    return payload?.data as T;
  }

  getCatalog() {
    return this.request<CatalogItem[]>('GET', '/api/agent/v1/catalog');
  }

  getAvailability(from: string, to: string, catalogItemId: string) {
    const qs = new URLSearchParams({ from, to, catalogItemId });
    return this.request<Availability>('GET', `/api/agent/v1/availability?${qs.toString()}`);
  }

  getPatientContext(phone: string) {
    const qs = new URLSearchParams({ phone });
    return this.request<PatientContext>('GET', `/api/agent/v1/patients/context?${qs.toString()}`);
  }

  createPatient(input: CreatePatientInput) {
    return this.request<Patient>('POST', '/api/agent/v1/patients', input);
  }

  createAppointment(input: CreateAppointmentInput) {
    return this.request<Appointment>('POST', '/api/agent/v1/appointments', input);
  }

  rescheduleAppointment(id: string, input: RescheduleAppointmentInput) {
    return this.request<Appointment>('PATCH', `/api/agent/v1/appointments/${encodeURIComponent(id)}`, input);
  }

  cancelAppointment(id: string) {
    return this.request<Appointment>('DELETE', `/api/agent/v1/appointments/${encodeURIComponent(id)}`);
  }

  searchPatients(q: string) {
    const qs = new URLSearchParams({ q });
    return this.request<Patient[]>('GET', `/api/agent/v1/patients?${qs.toString()}`);
  }

  createQuote(input: CreateQuoteInput) {
    return this.request<Quote>('POST', '/api/agent/v1/quotes', input);
  }

  listQuotes() {
    return this.request<Quote[]>('GET', '/api/agent/v1/quotes');
  }

  createPrescription(input: CreatePrescriptionInput) {
    return this.request<Prescription>('POST', '/api/agent/v1/prescriptions', input);
  }

  listPrescriptions() {
    return this.request<Prescription[]>('GET', '/api/agent/v1/prescriptions');
  }

  createCertificate(input: CreateCertificateInput) {
    return this.request<MedicalCertificate>('POST', '/api/agent/v1/certificates', input);
  }

  listCertificates() {
    return this.request<MedicalCertificate[]>('GET', '/api/agent/v1/certificates');
  }
}
