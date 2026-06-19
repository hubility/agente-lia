import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../../services/LiaApiClient.js';

// Tools agnósticas al paciente, reutilizadas tal cual en modo admin.
import { createListCatalogTool } from '../ListCatalog.js';
import { createCheckAvailabilityTool } from '../CheckAvailability.js';
import { createRescheduleAppointmentTool } from '../RescheduleAppointment.js';
import { createCancelAppointmentTool } from '../CancelAppointment.js';

// Tools específicas de admin.
import { createSearchPatientTool } from './SearchPatient.js';
import { createGetPatientOverviewTool } from './GetPatientOverview.js';
import { createScheduleAppointmentAdminTool } from './ScheduleAppointmentAdmin.js';
import { createCreateQuoteTool } from './CreateQuote.js';
import { createCreatePrescriptionTool } from './CreatePrescription.js';
import { createCreateCertificateTool } from './CreateCertificate.js';
import {
  createListQuotesTool,
  createListPrescriptionsTool,
  createListCertificatesTool,
} from './ListDocuments.js';

// Toolset del modo admin: consulta de pacientes, agenda y emissão de documentos.
export function createAdminTools(client: LiaApiClient): IBaseTool[] {
  return [
    createSearchPatientTool(client),
    createGetPatientOverviewTool(client),
    createListCatalogTool(client),
    createCheckAvailabilityTool(client),
    createScheduleAppointmentAdminTool(client),
    createRescheduleAppointmentTool(client),
    createCancelAppointmentTool(client),
    createCreateQuoteTool(client),
    createCreatePrescriptionTool(client),
    createCreateCertificateTool(client),
    createListQuotesTool(client),
    createListPrescriptionsTool(client),
    createListCertificatesTool(client),
  ];
}
