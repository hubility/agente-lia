import type { IBaseTool } from '@hubility/agents-amber';
import type { LiaApiClient } from '../services/LiaApiClient.js';

import { createGetPatientContextTool } from './GetPatientContext.js';
import { createListCatalogTool } from './ListCatalog.js';
import { createCheckAvailabilityTool } from './CheckAvailability.js';
import { createScheduleAppointmentTool } from './ScheduleAppointment.js';
import { createRescheduleAppointmentTool } from './RescheduleAppointment.js';
import { createCancelAppointmentTool } from './CancelAppointment.js';
import { createCreatePatientTool } from './CreatePatient.js';

// Todas as tools de Lia, ligadas ao cliente da API do consultório.
export function createLiaTools(client: LiaApiClient): IBaseTool[] {
  return [
    createGetPatientContextTool(client),
    createListCatalogTool(client),
    createCheckAvailabilityTool(client),
    createScheduleAppointmentTool(client),
    createRescheduleAppointmentTool(client),
    createCancelAppointmentTool(client),
    createCreatePatientTool(client),
  ];
}
