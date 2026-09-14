import sys

file_path = r'src\sidepanel.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    
    const maxFiles = Math.min(files.length, 5 - selectedImages.length);
    if (maxFiles <= 0) return;

    const processImage = (file: File): Promise<string> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            let { width, height } = img;
            const MAX_DIM = 800;

            if (width > height && width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            } else if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL("image/jpeg", 0.7));
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      });
    };

    setIsLoading(true);
    const newImages = await Promise.all(
      Array.from(files).slice(0, maxFiles).map(f => processImage(f))
    );
    setSelectedImages(prev => [...prev, ...newImages]);
    setIsLoading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  }'''

replace = '''  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const MAX_DIM = 800;

          if (width > height && width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          } else if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) ctx.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    
    const maxFiles = Math.min(files.length, 5 - selectedImages.length);
    if (maxFiles <= 0) return;

    setIsLoading(true);
    const newImages = await Promise.all(
      Array.from(files).slice(0, maxFiles).map(f => processImage(f))
    );
    setSelectedImages(prev => [...prev, ...newImages]);
    setIsLoading(false);
    
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    
    if (imageFiles.length > 0) {
      const maxFiles = Math.min(imageFiles.length, 5 - selectedImages.length);
      if (maxFiles <= 0) return;
      
      setIsLoading(true);
      const newImages = await Promise.all(
        imageFiles.slice(0, maxFiles).map(f => processImage(f))
      );
      setSelectedImages(prev => [...prev, ...newImages]);
      setIsLoading(false);
    }
  }'''

content = content.replace(target, replace)

target_textarea = '''            <textarea
              ref={inputRef}
              className="hands-input"
              placeholder="Tell Hands what to do..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isLoading}
            />'''

replace_textarea = '''            <textarea
              ref={inputRef}
              className="hands-input"
              placeholder="Tell Hands what to do..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              rows={1}
              disabled={isLoading}
            />'''

content = content.replace(target_textarea, replace_textarea)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)
