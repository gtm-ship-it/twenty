import { Module } from '@nestjs/common';

import { AtlasCallsResolver } from 'src/engine/core-modules/atlas-calls/atlas-calls.resolver';
import { AtlasApiClientService } from 'src/engine/core-modules/atlas-calls/services/atlas-api-client.service';
import { AtlasCallTargetsService } from 'src/engine/core-modules/atlas-calls/services/atlas-call-targets.service';
import { SecureHttpClientModule } from 'src/engine/core-modules/secure-http-client/secure-http-client.module';

// "Call with Atlas": manda los registros seleccionados en el CRM a una campaña
// de llamadas de Atlas (tenants PTS y Sunset). Solo para los workspaces listados
// en ATLAS_ALLOWED_WORKSPACE_IDS; las llaves nunca salen del servidor.
@Module({
  imports: [SecureHttpClientModule],
  providers: [
    AtlasCallsResolver,
    AtlasApiClientService,
    AtlasCallTargetsService,
  ],
  exports: [],
})
export class AtlasCallsModule {}
