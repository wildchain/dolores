import { Body, Controller, Post } from '@nestjs/common';
import { IpfsService } from './ipfs.service';
import { PinManifestDto } from './pin-manifest.dto';

@Controller('ipfs')
export class IpfsController {
  constructor(private readonly ipfsService: IpfsService) {}

  @Post('pin-manifest')
  async pinManifest(@Body() dto: PinManifestDto): Promise<{ cid: string }> {
    const cid = await this.ipfsService.pinManifest(dto.manifest);
    return { cid };
  }
}
