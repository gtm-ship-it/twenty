import { styled } from '@linaria/react';
import { t } from '@lingui/core/macro';
import { useRef, useState } from 'react';
import { IconDownload, IconPaperclip, IconTrash } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { StyledFieldLabel } from '@/task-pipelines/components/TaskPipelineUi';
import { type TaskAttachment } from '@/task-pipelines/types/TaskPipelineTypes';

const StyledGrid = styled.div`
  display: grid;
  gap: ${themeCssVariables.spacing[2]};
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledItem = styled.div<{ isCover: boolean }>`
  border: 1px solid
    ${({ isCover }) =>
      isCover
        ? themeCssVariables.color.blue
        : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledThumb = styled.a`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  height: 90px;
  justify-content: center;

  img {
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
`;

const StyledInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 6px;
`;

const StyledName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xs};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StyledActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

const StyledAction = styled.button`
  align-items: center;
  background: transparent;
  border: none;
  color: ${themeCssVariables.font.color.tertiary};
  cursor: pointer;
  display: inline-flex;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 2px;
  padding: 0;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const StyledActionLink = styled.a`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: inline-flex;
  font-size: ${themeCssVariables.font.size.xs};
  gap: 2px;
  text-decoration: none;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
    text-decoration: underline;
  }
`;

const formatSize = (size: number | null) => {
  if (size === null) {
    return '';
  }

  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

type TaskAttachmentsProps = {
  attachments: TaskAttachment[];
  coverAttachmentId: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
  onSetCover: (attachmentId: string | null) => Promise<void>;
};

// Adjuntos de la tarjeta (las fotos de cada punto viven en su checklist y las
// imágenes pegadas en comentarios no se listan aquí).
export const TaskAttachments = ({
  attachments,
  coverAttachmentId,
  onUpload,
  onDelete,
  onSetCover,
}: TaskAttachmentsProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const visible = attachments.filter(
    (attachment) => attachment.purpose === 'ATTACHMENT',
  );

  return (
    <div>
      <StyledFieldLabel>
        {t`Attachments`} {visible.length > 0 && `· ${visible.length}`}
      </StyledFieldLabel>
      {visible.length > 0 && (
        <StyledGrid>
          {visible.map((attachment) => {
            const isCover = attachment.id === coverAttachmentId;

            return (
              <StyledItem key={attachment.id} isCover={isCover}>
                <StyledThumb
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  title={attachment.name}
                >
                  {attachment.isImage ? (
                    <img src={attachment.url} alt={attachment.name} />
                  ) : (
                    <IconPaperclip size={24} />
                  )}
                </StyledThumb>
                <StyledInfo>
                  <StyledName title={attachment.name}>
                    {attachment.name}
                  </StyledName>
                  <StyledActions>
                    <StyledActionLink
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t`Download`}
                    >
                      <IconDownload size={12} />
                      {formatSize(attachment.size)}
                    </StyledActionLink>
                    {attachment.isImage && (
                      <StyledAction
                        type="button"
                        onClick={() =>
                          void onSetCover(isCover ? null : attachment.id)
                        }
                      >
                        {isCover ? t`Remove cover` : t`Make cover`}
                      </StyledAction>
                    )}
                    <StyledAction
                      type="button"
                      aria-label={t`Delete attachment`}
                      onClick={() => void onDelete(attachment.id)}
                    >
                      <IconTrash size={12} />
                    </StyledAction>
                  </StyledActions>
                </StyledInfo>
              </StyledItem>
            );
          })}
        </StyledGrid>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={async (event) => {
          const files = Array.from(event.target.files ?? []);

          event.target.value = '';

          if (files.length === 0) {
            return;
          }

          setIsUploading(true);

          try {
            for (const file of files) {
              await onUpload(file);
            }
          } finally {
            setIsUploading(false);
          }
        }}
      />
      <Button
        title={isUploading ? t`Uploading…` : t`Attach a file`}
        size="small"
        variant="secondary"
        Icon={IconPaperclip}
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      />
    </div>
  );
};
