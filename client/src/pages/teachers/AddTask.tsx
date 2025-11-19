import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/task_form.css';

interface ClassAvailability {
    course: string;
    year: string;
    block: string;
}

const getSeniorHighCourses = () => [
    { value: 'STEM', label: 'STEM' },
    { value: 'ABM', label: 'ABM' },
    { value: 'HUMSS', label: 'HUMSS' },
    { value: 'CSS', label: 'CSS' }
];

const getCollegeCourses = () => [
    { value: 'BSIT', label: 'BSIT' },
    { value: 'BSED', label: 'BSED' },
    { value: 'BEED', label: 'BEED' },
    { value: 'BSBA', label: 'BSBA' },
    { value: 'BSA', label: 'BSA' },
    { value: 'BS CRIM', label: 'BS CRIM' }
];

function AddTask() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        subjectCode: '',
        taskSubject: '',
        taskTopic: '',
        taskAvailableTo: [] as ClassAvailability[],
        taskQuestionAnswer: []
    });
    const [error, setError] = useState('');

    // Update the addClassAvailability function
    const addClassAvailability = () => {
        setFormData({
            ...formData,
            taskAvailableTo: [
                ...formData.taskAvailableTo,
                { course: '', year: '', block: 'A' }
            ]
        });
    };

    // Remove a class availability entry
    const removeClassAvailability = (index: number) => {
        const updatedClasses = formData.taskAvailableTo.filter((_, i) => i !== index);
        setFormData({
            ...formData,
            taskAvailableTo: updatedClasses
        });
    };

    // Modify the updateClassAvailability function
    const updateClassAvailability = (index: number, field: keyof ClassAvailability, value: string) => {
        const updatedClasses = [...formData.taskAvailableTo];
        
        // If changing year level, reset course to appropriate default
        if (field === 'year') {
            const isSeniorHigh = ['G11', 'G12'].includes(value);
            updatedClasses[index] = {
                ...updatedClasses[index],
                year: value,
                course: isSeniorHigh ? 'STEM' : 'BSIT' // Default course based on year level
            };
        } else {
            updatedClasses[index] = {
                ...updatedClasses[index],
                [field]: value
            };
        }
        
        setFormData({
            ...formData,
            taskAvailableTo: updatedClasses
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const teacherName = `${user.userFname} ${user.userMname} ${user.userLname}`.trim();

            const response = await fetch('http://localhost:5000/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...formData,
                    subjectTeacher: teacherName
                })
            });

            if (!response.ok) throw new Error('Failed to create task');

            navigate('/solo-games/solo-task');
        } catch (err) {
            setError('Failed to create task');
        }
    };

    return (
        <div className="task-form-container">
            <h2>Create New Task</h2>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Subject Code:</label>
                    <input
                        type="text"
                        value={formData.subjectCode}
                        onChange={(e) => setFormData({
                            ...formData,
                            subjectCode: e.target.value
                        })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Subject Name:</label>
                    <input
                        type="text"
                        value={formData.taskSubject}
                        onChange={(e) => setFormData({
                            ...formData,
                            taskSubject: e.target.value
                        })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Topic:</label>
                    <input
                        type="text"
                        value={formData.taskTopic}
                        onChange={(e) => setFormData({
                            ...formData,
                            taskTopic: e.target.value
                        })}
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Available To:</label>
                    <button 
                        type="button" 
                        className="btn-add-class"
                        onClick={addClassAvailability}
                    >
                        Add Class
                    </button>
                    
                    {formData.taskAvailableTo.map((classItem, index) => (
                        <div key={index} className="class-row">
                            <select
                                value={classItem.year}
                                onChange={(e) => updateClassAvailability(index, 'year', e.target.value)}
                            >
                                <option value="">Select Year Level</option>
                                <optgroup label="Senior High">
                                    <option value="G11">Grade 11</option>
                                    <option value="G12">Grade 12</option>
                                </optgroup>
                                <optgroup label="College">
                                    <option value="1st">1st Year</option>
                                    <option value="2nd">2nd Year</option>
                                    <option value="3rd">3rd Year</option>
                                    <option value="4th">4th Year</option>
                                </optgroup>
                            </select>

                            <select
                                value={classItem.course}
                                onChange={(e) => updateClassAvailability(index, 'course', e.target.value)}
                            >
                                <option value="">Select Course</option>
                                {(['G11', 'G12'].includes(classItem.year) 
                                    ? getSeniorHighCourses() 
                                    : getCollegeCourses()
                                ).map(course => (
                                    <option key={course.value} value={course.value}>
                                        {course.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={classItem.block}
                                onChange={(e) => updateClassAvailability(index, 'block', e.target.value)}
                            >
                                <option value="">Select Block</option>
                                <option value="A">Block A</option>
                                <option value="B">Block B</option>
                                <option value="C">Block C</option>
                                <option value="D">Block D</option>
                                <option value="E">Block E</option>
                                <option value="F">Block F</option>
                            </select>

                            <button 
                                type="button"
                                className="btn-remove"
                                onClick={() => removeClassAvailability(index)}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn-submit">
                        Create Task
                    </button>
                    <button 
                        type="button" 
                        className="btn-cancel"
                        onClick={() => navigate('/solo-games/solo-task')}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AddTask;