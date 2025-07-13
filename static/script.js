document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const uploadButton = document.getElementById('upload-button');
    const gallery = document.getElementById('gallery');
    const imagePreview = document.getElementById('image-preview');
    const resultsContainer = document.getElementById('results-container');
    const selectedFilename = document.getElementById('selected-filename');

    let filesMap = new Map();
    let resultsData = [];

    fileInput.addEventListener('change', (event) => {
        gallery.innerHTML = '';
        filesMap.clear();
        resultsData = [];
        imagePreview.src = '';
        selectedFilename.textContent = '';
        resultsContainer.innerHTML = '<p>请上传文件并开始识别。</p>';

        const files = event.target.files;
        if (files.length === 0) return;

        for (const file of files) {
            const reader = new FileReader();
            const fileId = `file-${Date.now()}-${Math.random()}`;
            filesMap.set(fileId, file);

            reader.onload = (e) => {
                const item = document.createElement('div');
                item.classList.add('thumbnail-item');
                item.dataset.fileId = fileId;

                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('thumbnail');

                const name = document.createElement('div');
                name.classList.add('thumbnail-name');
                name.textContent = file.name;

                const progressContainer = document.createElement('div');
                progressContainer.classList.add('progress-container');
                const progressBar = document.createElement('div');
                progressBar.classList.add('progress-bar');
                progressContainer.appendChild(progressBar);

                const progressText = document.createElement('div');
                progressText.classList.add('progress-text');
                progressText.textContent = '待上传';

                item.appendChild(img);
                item.appendChild(name);
                item.appendChild(progressContainer);
                item.appendChild(progressText);
                item.onclick = () => selectImage(item);
                gallery.appendChild(item);

                if (gallery.children.length === 1) {
                    item.click();
                }
            };
            reader.readAsDataURL(file);
        }
    });

    function selectImage(itemElement) {
        document.querySelectorAll('.thumbnail-item').forEach(item => item.classList.remove('selected'));
        itemElement.classList.add('selected');
        
        const fileId = itemElement.dataset.fileId;
        const file = filesMap.get(fileId);
        const img = itemElement.querySelector('.thumbnail');
        
        imagePreview.src = img.src;
        selectedFilename.textContent = file.name;

        const result = resultsData.find(r => r.fileId === fileId);
        if (result) {
            displayResult(result.data);
        } else {
            resultsContainer.innerHTML = '<p>该图片的识别结果尚未生成。</p>';
        }
    }

    function displayResult(data) {
        if (!data || !data.evidence_type) { // Check for data and evidence_type
            resultsContainer.innerHTML = '<p>无法显示结果或结果格式不正确。</p>';
            return;
        }
        resultsContainer.innerHTML = `
            <div class="result-item"><strong>证据类型:</strong> ${data.evidence_type}</div>
            <div class="result-item"><strong>置信度:</strong> ${data.confidence}</div>
            <div class="result-item"><strong>分析说明:</strong> ${data.reasoning}</div>
        `;
    }

    uploadButton.addEventListener('click', () => {
        if (filesMap.size === 0) {
            alert('请先选择文件');
            return;
        }

        resultsContainer.innerHTML = '<p>正在识别中，请稍候...</p>';
        
        filesMap.forEach((file, fileId) => {
            const thumbItem = document.querySelector(`.thumbnail-item[data-file-id="${fileId}"]`);
            uploadFileViaWebSocket(file, thumbItem);
        });
    });

    function uploadFileViaWebSocket(file, thumbItem) {
        const progressBar = thumbItem.querySelector('.progress-bar');
        const progressText = thumbItem.querySelector('.progress-text');
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/v1/agentic/ws/classify`);

        ws.onopen = () => {
            progressText.textContent = '连接成功，正在上传...';
            ws.send(file);
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.status) {
                case 'uploading':
                    progressBar.style.width = '25%';
                    progressText.textContent = '上传中...';
                    break;
                case 'uploaded':
                    progressBar.style.width = '50%';
                    progressText.textContent = '上传完成';
                    break;
                case 'classifying':
                    progressBar.style.width = '75%';
                    progressText.textContent = '识别中...';
                    break;
                case 'completed':
                    progressBar.style.width = '100%';
                    progressText.textContent = '识别完成';
                    const fileId = thumbItem.dataset.fileId;
                    // The result is now for a single file, access it directly
                    const result = data.result.results[0]; 
                    resultsData.push({ fileId: fileId, data: result });
                    if (thumbItem.classList.contains('selected')) {
                        displayResult(result);
                    }
                    ws.close();
                    break;
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket Error:', error);
            progressText.textContent = '连接失败';
            progressBar.style.backgroundColor = 'red';
        };

        ws.onclose = () => {
            console.log(`WebSocket connection closed for ${file.name}`);
        };
    }
});