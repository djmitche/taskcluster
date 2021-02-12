use crate::Object;
use anyhow::Result;
use serde_json::json;
use slugid;
use std::io::{Read, Seek, SeekFrom};

const DATA_INLINE_MAX_SIZE: u64 = 8192;

/* Random thoughts
 *
 * Maybe wrap this into an Upload struct that can carry around the necessary fields, including
 * optional fields like retry configuration and private but fixed fields like uploadId.
 *
 * This code structure won't work for method negotiation..
 *
 * Maybe this doesn't need to be its own module directory? Maybe re-export from crate root?
 */

/// Upload the given data as an object to the object service.  The given `Object` instance should
/// be pre-configured with appropriate credentials.  This function may seek over the data several
/// times, so it cannot be used as a stream consumer.
///
/// Common types for D are [std::io::File] and (`std::io::Cursor<&[u8]>`)[std::io::Cursor].
pub async fn upload_object<D, S1, S2, S3>(
    project_id: S1,
    name: S2,
    content_type: S3,
    data: &mut D,
    svc: &Object,
) -> Result<()>
where
    D: Read + Seek,
    S1: AsRef<str>,
    S2: AsRef<str>,
    S3: AsRef<str>,
{
    let len = seekable_len(data)?;
    if len < DATA_INLINE_MAX_SIZE {
        data.seek(SeekFrom::Start(0))?;
        let mut buf = vec![];
        data.read_to_end(&mut buf)?;
        upload_data_inline(
            project_id.as_ref(),
            name.as_ref(),
            content_type.as_ref(),
            &buf[..],
            svc,
        )
        .await
    } else {
        todo!()
    }
}

async fn upload_data_inline(
    project_id: &str,
    name: &str,
    content_type: &str,
    data: &[u8],
    svc: &Object,
) -> Result<()> {
    let upload_id = slugid::v4();
    let expires = "2021-02-13T21:48:04.182Z"; // TODO
    let data_b64 = base64::encode(data);

    svc.createUpload(
        name,
        &json!({
            "expires": expires,
            "projectId": project_id,
            "uploadId": upload_id,
            "proposedUploadMethods": {
                "dataInline": {
                    "contentType": content_type,
                    "objectData": data_b64,
                }
            },
        }),
    )
    .await?;

    svc.finishUpload(
        name,
        &json!({
            "projectId": project_id,
            "uploadId": upload_id,
        }),
    )
    .await?;

    Ok(())
}

/// Get the length of a seekable object, destroying the current position of the stream in the
/// process.
fn seekable_len<D: Seek>(data: &mut D) -> std::io::Result<u64> {
    // NOTE: https://github.com/rust-lang/rust/issues/59359 may make this part of std::io::Seek
    data.seek(SeekFrom::End(0))
}

/*
#[cfg(test)]
mod test {
    #[test]
}
*/
